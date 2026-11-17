import jsonata from 'jsonata';
import { parsePaymentCode, VALUE_CHECKS } from '@repo/fintivio/utilities';
import { Inject, Injectable, Scope } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import type { Tenant, User } from '@repo/fintivio/schemas';
import { caseFiles, clientProfiles } from '../entities';
import { TENANT } from '../injector/tokens/tenant.token';
import { USER } from '../injector/tokens/user.token';
import { CASE_REPOSITORY, ENGINE_CLIENT, type EngineClient } from '../engine/engine.client';
import type { CaseRepository } from '../engine/case-repository';
import { AuditWriter, type AuditActor } from '../services/audit.writer';
import { CasesService } from '../services/cases.service';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, UnprocessableError } from '../http/errors';
import type { ScreenDefinition } from '../engine/components/client-app';
import { ensureProfile, loadMe, markNotificationsRead, updateProfile } from './profiles';
import { evaluateRule, journeyState, loadActiveDefinition, resolveSources } from './runtime-data';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * What a signed-in client does in their app (docs/plans/11 §2.3): read the published app and the data it declares,
 * start journeys (eligibility checked here, never trusted from the browser), fill journey screens, keep their profile,
 * consents and notifications. Everything acts on the client's own data only.
 */
@Injectable({ scope: Scope.REQUEST })
export class ClientRuntimeService {
  constructor(
    @Inject(CASE_REPOSITORY) private readonly repository: CaseRepository,
    @Inject(ENGINE_CLIENT) private readonly engine: EngineClient,
    @Inject(CasesService) private readonly cases: CasesService,
    @Inject(TENANT) private readonly tenant: Tenant,
    @Inject(USER) private readonly user: User,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
  ) { }

  private get db() {
    return this.repository.db(this.tenant.id);
  }

  private get actor(): AuditActor {
    return { type: 'client', id: this.user.userId, email: this.user.email };
  }

  private async definition() {
    const active = await loadActiveDefinition(this.db);
    if (!active) throw new NotFoundError('This institution has not published an app yet');
    return active.definition;
  }

  /** The published app (identity settings stay on the server), with the institution's branding. */
  async app() {
    const active = await loadActiveDefinition(this.db);
    const institution = { name: this.tenant.name, pallette: this.tenant.pallette, logoUrl: this.tenant.logoUrl };
    if (!active) return { available: false, institution };
    const { identity: _identity, ...definition } = active.definition;
    return { available: true, version: active.version, definition, institution };
  }

  async data(body: { sources?: unknown }) {
    const sources = Array.isArray(body?.sources) ? body.sources.map(String).slice(0, 20) : ['me'];
    const result = await resolveSources(this.db, this.user.userId, await this.definition(), sources);
    if ('error' in result) throw new ForbiddenError(String(result.error));
    return result.data;
  }

  async startJourney(key: string, body: { input?: Record<string, unknown> }) {
    const definition = await this.definition();
    const journey = definition.journeys[key];
    if (!journey) throw new NotFoundError('This journey does not exist');
    const me = (await loadMe(this.db, this.user.userId))!;
    if (!(await evaluateRule(journey.eligibility, me))) throw new ForbiddenError('This is not available to you');
    // Only declared inputs, only simple values: a button cannot inject arbitrary case data.
    const input: Record<string, unknown> = {};
    for (const name of journey.inputs) {
      const value = body?.input?.[name];
      if (['string', 'number', 'boolean'].includes(typeof value)) input[name] = typeof value === 'string' ? value.slice(0, 500) : value;
    }
    const kase = await this.cases.start({
      workflowId: journey.workflowId,
      data: { ...input, email: me.email, fullName: me.name },
      applicant: { id: me.id, email: me.email, name: me.name },
      source: `client:${key}`,
      initiatedBy: this.actor,
    });
    return this.settle(kase.id);
  }

  async journey(caseId: string) {
    const state = await journeyState(this.db, this.user.userId, caseId, (await loadActiveDefinition(this.db))?.definition ?? null);
    if (!state) throw new NotFoundError('Not found');
    return state;
  }

  /**
   * After a start or a submission, wait briefly for the engine to reach the next screen (or a waiting state) so the
   * client goes straight to it; the app keeps polling if the workflow needs longer.
   */
  private async settle(caseId: string, answeredTaskId?: string) {
    const definition = (await loadActiveDefinition(this.db))?.definition ?? null;
    const deadline = Date.now() + 5000;
    let state = await journeyState(this.db, this.user.userId, caseId, definition);
    while (state && Date.now() < deadline && (state.state === 'working' || (answeredTaskId && state.screen?.taskId === answeredTaskId))) {
      await sleep(150);
      state = await journeyState(this.db, this.user.userId, caseId, definition);
    }
    if (!state) throw new NotFoundError('Not found');
    return state;
  }

  /** Send a journey screen: the button chosen is the workflow's next event; answers are checked against the screen. */
  async submitScreen(caseId: string, taskId: string, body: { event?: string; values?: Record<string, unknown> }) {
    const task = await this.repository.getTask(this.tenant.id, taskId);
    if (!task || task.caseId !== caseId || task.audience !== 'client' || task.kind !== 'screen' || task.assigneeId !== this.user.userId) throw new NotFoundError('Screen not found');
    if (task.status !== 'open') throw new ConflictError('This screen was already sent');
    const screen = task.screen as unknown as ScreenDefinition;
    const button = screen.buttons.find((b) => b.key === body?.event);
    if (!button) throw new BadRequestError('Unknown button');
    const strict = !button.skipValidation;
    const raw = body?.values ?? {};
    const values: Record<string, unknown> = {};
    const errors: Array<{ field: string; message: string }> = [];
    const fail = (field: string, message: string) => strict && errors.push({ field, message });

    // Fields shown only on a condition (`visibleIf` over the answers, with what scanned codes say as `<key>Details`)
    // are ignored when hidden, as in the app.
    const scope: Record<string, unknown> = { ...raw };
    for (const field of screen.fields) {
      if (field.type === 'scan' && field.parse && field.parse !== 'raw' && typeof raw[field.key] === 'string' && raw[field.key]) scope[`${field.key}Details`] = parsePaymentCode(String(raw[field.key]), field.parse);
    }
    const shown = async (field: ScreenDefinition['fields'][number]) => {
      if (!field.visibleIf) return true;
      try {
        return Boolean(await jsonata(field.visibleIf.replace(/^\s*=/, '')).evaluate(scope));
      } catch {
        return true;
      }
    };
    for (const field of screen.fields) {
      if (field.type === 'display' || !(await shown(field))) continue;
      const value = raw[field.key];
      const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length) || (field.type === 'checkbox' && value !== true);
      if (empty) {
        if (field.required) fail(field.key, `${field.label}: required`);
        if (field.type === 'checkbox') values[field.key] = false;
        continue;
      }
      switch (field.type) {
        case 'number':
        case 'slider':
        case 'money': {
          const n = Number(value);
          if (!Number.isFinite(n)) { fail(field.key, `${field.label}: enter a number`); break; }
          if (field.min !== undefined && n < field.min) { fail(field.key, `${field.label}: at least ${field.min}`); break; }
          if (field.max !== undefined && n > field.max) { fail(field.key, `${field.label}: at most ${field.max}`); break; }
          values[field.key] = field.type === 'money' ? Math.round(n * 100) / 100 : n;
          break;
        }
        case 'email':
          if (!EMAIL.test(String(value))) fail(field.key, `${field.label}: enter a valid e-mail address`);
          else values[field.key] = String(value).trim();
          break;
        case 'date':
          if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value)) || Number.isNaN(Date.parse(String(value)))) fail(field.key, `${field.label}: enter a date`);
          else values[field.key] = String(value);
          break;
        case 'select':
        case 'choice':
          if (!(field.options ?? []).some((o) => o.value === String(value))) fail(field.key, `${field.label}: choose one of the options`);
          else values[field.key] = String(value);
          break;
        case 'checkbox':
          values[field.key] = true;
          break;
        case 'otp': {
          const digits = String(value).replace(/\s+/g, '');
          if (!new RegExp(`^\\d{${field.length ?? 6}}$`).test(digits)) fail(field.key, `${field.label}: enter the ${field.length ?? 6} digits`);
          else values[field.key] = digits;
          break;
        }
        case 'scan': {
          const text = String(value).trim().slice(0, 4000);
          values[field.key] = text;
          // What the code says, for the next steps (input.<key>Details): a payment's payee, amount, account…
          if (field.parse && field.parse !== 'raw') {
            const details = parsePaymentCode(text, field.parse);
            if (!details.valid && field.parse !== 'auto') fail(field.key, `${field.label}: ${details.problem ?? 'this code cannot be read'}`);
            const { raw: _raw, ...rest } = details;
            values[`${field.key}Details`] = rest;
          }
          break;
        }
        case 'signature':
        case 'file': {
          const ids = [value].flat().map(String);
          if (!ids.every((id) => UUID.test(id))) { fail(field.key, `${field.label}: the files are not ready yet or were refused`); break; }
          const files = await this.db.select().from(caseFiles).where(and(inArray(caseFiles.id, ids), eq(caseFiles.taskId, task.id), eq(caseFiles.itemKey, field.key), eq(caseFiles.uploadedById, this.user.userId)));
          if (files.length !== new Set(ids).size) fail(field.key, `${field.label}: the files are not ready yet or were refused`);
          else values[field.key] = files.map((f) => ({ fileId: f.id, name: f.name, contentType: f.contentType, size: f.size }));
          break;
        }
        default:
          values[field.key] = String(value).slice(0, 5000);
      }
      // Format rules of text answers: a pattern, an IBAN, a card number…
      const given = values[field.key];
      if (typeof given === 'string' && given) {
        if (field.pattern) {
          let ok = true;
          try { ok = new RegExp(field.pattern).test(given); } catch { /* a broken pattern was refused at publication */ }
          if (!ok) fail(field.key, `${field.label}: ${field.patternMessage ?? 'not in the expected format'}`);
        }
        if (field.check && VALUE_CHECKS[field.check] && !VALUE_CHECKS[field.check].test(given)) fail(field.key, `${field.label}: ${VALUE_CHECKS[field.check].message}`);
      }
    }
    if (errors.length) throw new UnprocessableError('Please check the highlighted fields', errors);

    await this.repository.updateTask(this.tenant.id, taskId, { status: 'completed', response: { ...values, button: button.key } });
    await this.audit.record(this.tenant.id, this.actor, 'client_request.answered', { type: 'task', id: taskId, title: screen.title }, { button: button.key, fields: Object.keys(values) }, caseId);
    await this.engine.signal(this.tenant.id, caseId, taskId, { outcome: button.key, response: values, by: { id: this.user.userId, email: this.user.email, type: 'client' } });
    return this.settle(caseId, taskId);
  }

  /** Change the profile fields the app lets clients edit. */
  async updateProfile(body: { fields?: Record<string, unknown> }) {
    const definition = await this.definition();
    const editable = new Map(definition.profile.fields.filter((f) => f.editable).map((f) => [f.key, f]));
    const attributes: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body?.fields ?? {})) {
      const field = editable.get(key);
      if (!field) throw new ForbiddenError(`${key} cannot be changed here`);
      const text = value === null || value === undefined ? '' : String(value).trim().slice(0, 500);
      if (field.required && !text) throw new BadRequestError(`${field.label} is required`);
      if (field.type === 'email' && text && !EMAIL.test(text)) throw new BadRequestError(`${field.label}: enter a valid e-mail address`);
      if (field.type === 'phone' && text && !/^\+?[0-9 ()-]{6,20}$/.test(text)) throw new BadRequestError(`${field.label}: enter a valid phone number`);
      if (field.type === 'select' && text && !(field.options ?? []).includes(text)) throw new BadRequestError(`${field.label}: choose one of the options`);
      if (field.type === 'number' && text && !Number.isFinite(Number(text))) throw new BadRequestError(`${field.label}: enter a number`);
      attributes[key] = field.type === 'number' && text ? Number(text) : text;
    }
    await updateProfile(this.db, this.user.userId, { attributes });
    await this.audit.record(this.tenant.id, this.actor, 'client_profile.updated', { type: 'user', id: this.user.userId }, { fields: Object.keys(attributes) });
    return loadMe(this.db, this.user.userId);
  }

  /** Record consents (terms, privacy notice…) with the version accepted. */
  async acceptConsents(body: { consents?: Array<{ key?: string; version?: string }> }) {
    const definition = await this.definition();
    const known = new Map(definition.registration.consents.map((c) => [c.key, c]));
    const accepted = (body?.consents ?? []).filter((c) => c.key && known.has(c.key) && known.get(c.key)!.version === c.version);
    if (!accepted.length) throw new BadRequestError('Nothing to accept');
    const profile = await ensureProfile(this.db, this.user.userId);
    const at = new Date().toISOString();
    const consents = [...profile.consents.filter((c) => !accepted.some((a) => a.key === c.key)), ...accepted.map((a) => ({ key: a.key!, version: a.version!, acceptedAt: at }))];
    await this.db.update(clientProfiles).set({ consents }).where(eq(clientProfiles.id, profile.id));
    await this.audit.record(this.tenant.id, this.actor, 'client.consented', { type: 'user', id: this.user.userId }, { consents: accepted.map((a) => `${a.key}@${a.version}`) });
    return loadMe(this.db, this.user.userId);
  }

  async readNotifications(id?: string) {
    await markNotificationsRead(this.db, this.user.userId, id);
    return { ok: true };
  }
}
