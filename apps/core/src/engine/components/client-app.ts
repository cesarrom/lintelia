import * as restate from '@restatedev/restate-sdk/fetch';
import jsonata from 'jsonata';
import { durationMs } from '../durations';
import { resolveConfig } from '../expressions';
import { WORKFLOW_ACTOR, type EngineComponent, type TaskSignal } from './types';
import { and, eq, sql } from 'drizzle-orm';
import { clientProfiles, users } from '../../entities';
import { ensureProfile, listRecords, loadMe, notify, updateProfile, writeRecord } from '../../client-apps/profiles';

/**
 * Components of client journeys (docs/plans/11): a designed screen the client fills in their app, and the client's
 * data (records, profile, notifications) that workflows read and write. They act on the case's applicant, or on
 * another client (`client`, e.g. the borrower of a deal a dealer submitted, created by `client.upsert`).
 */

export const SCREEN_FIELD_TYPES = ['text', 'email', 'phone', 'number', 'money', 'date', 'select', 'choice', 'checkbox', 'textarea', 'file', 'scan', 'signature', 'otp', 'slider', 'display'] as const;
/** Formats a scanned code is read as (packages/fintivio payment-codes): details in `input.<key>Details`. */
export const SCAN_PARSERS = ['raw', 'auto', 'emv', 'epc', 'url', 'json'] as const;

/** Field types each option applies to (the editor shows an option only for them: `x-show-if`). */
const CHOICES = ['select', 'choice'];
const NUMERIC = ['number', 'money', 'slider'];
const TEXTUAL = ['text', 'phone', 'textarea', 'scan'];

const FIELD_ITEM = {
  type: 'object',
  properties: {
    key: { type: 'string', title: 'Key', description: 'name of the answer: input.<key> in later steps' },
    label: { type: 'string', title: 'Label' },
    type: {
      type: 'string', title: 'Type', enum: [...SCREEN_FIELD_TYPES], default: 'text',
      'x-enum-labels': ['Text', 'E-mail', 'Phone', 'Number', 'Amount of money', 'Date', 'Drop-down', 'Choice cards', 'Checkbox', 'Long text', 'File upload', 'QR / barcode scanner', 'Signature', 'Code (OTP / PIN)', 'Slider', 'Calculated value (shown)'],
    },
    required: { type: 'boolean', title: 'Required' },
    help: { type: 'string', title: 'Help text' },
    placeholder: { type: 'string', title: 'Placeholder', 'x-show-if': { type: ['text', 'email', 'phone', 'number', 'money', 'textarea'] } },
    options: { type: 'array', title: 'Options', description: 'one per entry; "value|label" to show a different label', items: { type: 'string' }, 'x-show-if': { type: CHOICES } },
    optionsFrom: { type: 'string', title: 'Options from collection', description: 'e.g. accounts (the client\'s records)', 'x-show-if': { type: CHOICES } },
    optionFilter: { type: 'string', title: 'Filter options', description: 'JSONata over each record, e.g. type = "current"', 'x-show-if': { type: CHOICES } },
    optionLabel: { type: 'string', title: 'Option label', description: 'e.g. {{item.name}}', 'x-show-if': { type: CHOICES } },
    optionValue: { type: 'string', title: 'Option value', description: 'e.g. {{item.key}}', 'x-show-if': { type: CHOICES } },
    default: { type: 'string', title: 'Prefill', description: 'e.g. {{me.phone}}', 'x-expression': true },
    min: { type: 'number', title: 'Minimum', 'x-show-if': { type: NUMERIC } },
    max: { type: 'number', title: 'Maximum', 'x-show-if': { type: NUMERIC } },
    step: { type: 'number', title: 'Step (slider)', 'x-show-if': { type: ['slider'] } },
    width: { type: 'string', title: 'Width', enum: ['full', 'half'], 'x-enum-labels': ['Full width', 'Half (two side by side)'] },
    visibleIf: { type: 'string', title: 'Show only when', description: 'JSONata over this screen\'s answers, e.g. accountType = "business"' },
    pattern: { type: 'string', title: 'Must match (regular expression)', description: 'e.g. ^[A-Z]{2}[0-9]{6}$', 'x-show-if': { type: TEXTUAL } },
    patternMessage: { type: 'string', title: 'Message when it does not match', 'x-show-if': { type: TEXTUAL } },
    check: { type: 'string', title: 'Check', enum: ['', 'iban', 'luhn', 'email'], 'x-enum-labels': ['—', 'IBAN', 'Card number (Luhn)', 'E-mail'], 'x-show-if': { type: TEXTUAL } },
    scanCodes: { 'x-show-if': { type: ['scan'] }, type: 'string', title: 'Scanner: codes', enum: ['qr', 'barcode', 'any'], 'x-enum-labels': ['QR codes', 'Barcodes', 'QR codes and barcodes'] },
    parse: { 'x-show-if': { type: ['scan'] }, type: 'string', title: 'Scanner: read as', enum: [...SCAN_PARSERS], 'x-enum-labels': ['Text as it is', 'Recognise the format', 'EMV payment QR (Pix, Mercado Pago…)', 'SEPA transfer QR (EPC)', 'Link (upi://, https://…)', 'JSON'] },
    length: { type: 'number', title: 'Code: digits', description: 'OTP / PIN length (default 6)', 'x-show-if': { type: ['otp'] } },
    secret: { type: 'boolean', title: 'Code: hide the digits (PIN)', 'x-show-if': { type: ['otp'] } },
    capture: { 'x-show-if': { type: ['file'] }, type: 'string', title: 'File: take a photo', enum: ['', 'environment', 'user'], 'x-enum-labels': ['No (choose a file)', 'Back camera (documents)', 'Front camera (selfie)'] },
    expression: { type: 'string', title: 'Calculated value', description: 'JSONata over the answers, e.g. $round(amount * 1.079 / term, 2)', 'x-show-if': { type: ['display'] } },
    format: { type: 'string', title: 'Shown as', enum: ['text', 'number', 'money', 'percent'], 'x-enum-labels': ['Text', 'Number', 'Money', 'Percent'], 'x-show-if': { type: ['display', 'slider'] } },
  },
} as const;

const BUTTON_ITEM = {
  type: 'object',
  properties: {
    key: { type: 'string', title: 'Event', description: 'the branch it follows, e.g. continue, back' },
    label: { type: 'string', title: 'Label' },
    style: { type: 'string', title: 'Style', enum: ['primary', 'secondary', 'danger'], 'x-enum-labels': ['Primary', 'Secondary', 'Danger'] },
    skipValidation: { type: 'boolean', title: 'Do not check the fields (Back, Cancel)' },
  },
} as const;

export interface ScreenField {
  key: string;
  label: string;
  type: (typeof SCREEN_FIELD_TYPES)[number];
  required?: boolean;
  help?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
  width?: 'full' | 'half';
  /** JSONata over the screen's answers: the field shows (and is checked) only when true. */
  visibleIf?: string;
  pattern?: string;
  patternMessage?: string;
  check?: 'iban' | 'luhn' | 'email';
  scanCodes?: 'qr' | 'barcode' | 'any';
  parse?: (typeof SCAN_PARSERS)[number];
  length?: number;
  secret?: boolean;
  capture?: 'environment' | 'user';
  /** `display`: a value calculated live from the answers (JSONata), shown, not sent. */
  expression?: string;
  format?: 'text' | 'number' | 'money' | 'percent';
}

/** Press a button by itself: when every required field is filled and valid, or when a rule over the answers holds. */
export interface AutoSubmit {
  button: string;
  when: 'complete' | 'expression';
  expression?: string;
  /** Seconds shown as a countdown before it happens (0: at once). */
  delay?: number;
}

export interface ScreenDefinition {
  title: string;
  description?: string;
  content?: string;
  stage?: string;
  fields: ScreenField[];
  buttons: Array<{ key: string; label: string; style: 'primary' | 'secondary' | 'danger'; skipValidation?: boolean }>;
  values: Record<string, unknown>;
  autoSubmit?: AutoSubmit;
}

async function evalItem(expression: string | undefined, item: Record<string, unknown>, fallback: boolean) {
  if (!expression) return fallback;
  try {
    return Boolean(await jsonata(expression.replace(/^\s*=/, '')).evaluate(item));
  } catch {
    return false;
  }
}

/**
 * The screen a `client.screen` or `team.screen` step shows: fields (labels, options, prefills resolved against the
 * scope), buttons and auto-submit. `recordsOf` lists a collection of the client whose records fill `optionsFrom`.
 */
export async function buildScreen(step: { name: string; config: Record<string, any> }, scope: Record<string, unknown>, vars: Record<string, any>,
  recordsOf: (collection: string) => Promise<Array<Record<string, any>>>): Promise<ScreenDefinition> {
  const config = step.config as Record<string, any>;
  const text = async (value: unknown) => (typeof value === 'string' ? String(await resolveConfig(value, scope) ?? '') : undefined);
  const fields: ScreenField[] = [];
  const values: Record<string, unknown> = {};
  for (const raw of Array.isArray(config.fields) ? config.fields : []) {
    const opt = <T,>(value: unknown, ok: (v: unknown) => boolean, map: (v: any) => T = (v) => v as T) => (value !== undefined && value !== null && value !== '' && ok(value) ? map(value) : undefined);
    const field: ScreenField = {
      key: String(raw.key), label: String(await text(raw.label) ?? raw.key), type: raw.type ?? 'text', required: !!raw.required,
      help: await text(raw.help), placeholder: raw.placeholder ? String(raw.placeholder) : undefined,
      min: typeof raw.min === 'number' ? raw.min : undefined, max: typeof raw.max === 'number' ? raw.max : undefined,
      step: opt(raw.step, (v) => typeof v === 'number' && v > 0),
      width: opt(raw.width, (v) => v === 'half' || v === 'full'),
      visibleIf: opt(raw.visibleIf, (v) => typeof v === 'string', String),
      pattern: opt(raw.pattern, (v) => typeof v === 'string', String),
      patternMessage: opt(raw.patternMessage, (v) => typeof v === 'string', String),
      check: opt(raw.check, (v) => ['iban', 'luhn', 'email'].includes(String(v))),
      scanCodes: opt(raw.scanCodes, (v) => ['qr', 'barcode', 'any'].includes(String(v))),
      parse: opt(raw.parse, (v) => (SCAN_PARSERS as readonly string[]).includes(String(v))),
      length: opt(raw.length, (v) => typeof v === 'number' && v >= 3 && v <= 12),
      secret: raw.secret === true ? true : undefined,
      capture: opt(raw.capture, (v) => v === 'environment' || v === 'user'),
      expression: opt(raw.expression, (v) => typeof v === 'string', String),
      format: opt(raw.format, (v) => ['text', 'number', 'money', 'percent'].includes(String(v))),
    };
    for (const key of Object.keys(field) as Array<keyof ScreenField>) if (field[key] === undefined) delete field[key];
    if (Array.isArray(raw.options) && raw.options.length) {
      field.options = raw.options.map((o: unknown) => {
        if (typeof o === 'object' && o) return o as { value: string; label: string };
        const [value, label] = String(o).split('|');
        return { value: value.trim(), label: (label ?? value).trim() };
      });
    }
    if (raw.optionsFrom) {
      const records = await recordsOf(String(raw.optionsFrom));
      field.options = [];
      for (const item of records) {
        if (!(await evalItem(raw.optionFilter, item, true))) continue;
        const itemScope = { ...scope, item };
        field.options.push({
          value: raw.optionValue ? String(await resolveConfig(String(raw.optionValue), itemScope) ?? '') : String(item.key),
          label: raw.optionLabel ? String(await resolveConfig(String(raw.optionLabel), itemScope) ?? '') : String(item.name ?? item.key),
        });
      }
    }
    // Prefill: the answer already given in this case (coming back to a screen), else the configured default.
    const given = (vars.input ?? {})[field.key];
    if (given !== undefined && given !== null && given !== '') values[field.key] = given;
    else if (raw.default !== undefined && raw.default !== '') values[field.key] = await resolveConfig(raw.default, scope);
    fields.push(field);
  }
  const definition: ScreenDefinition = {
    title: String(await text(config.title) ?? step.name),
    description: await text(config.description),
    content: await text(config.content),
    stage: config.stage ? String(config.stage) : undefined,
    fields,
    buttons: (Array.isArray(config.buttons) && config.buttons.length ? config.buttons : [{ key: 'continue', label: 'Continue', style: 'primary' }])
      .map((b: any) => ({ key: String(b.key), label: String(b.label ?? b.key), style: b.style ?? 'primary', skipValidation: !!b.skipValidation })),
    values,
    ...(config.autoSubmit?.button ? {
      autoSubmit: {
        button: String(config.autoSubmit.button), when: config.autoSubmit.when === 'expression' ? 'expression' : 'complete',
        ...(config.autoSubmit.expression ? { expression: String(config.autoSubmit.expression) } : {}),
        delay: Math.max(0, Math.min(60, Number(config.autoSubmit.delay) || 0)),
      } as AutoSubmit,
    } : {}),
  };
  return definition;
}

const clientScreen: EngineComponent = {
  definition: {
    type: 'client.screen', version: 1, title: 'Client screen', description: 'A screen of a client journey: fields, text and buttons in the app. Each button is an event; the answers become input.<key>.',
    icon: 'AppWindow', category: 'client', kind: 'client', source: { kind: 'builtin' },
    configSchema: {
      type: 'object',
      required: ['title', 'buttons'],
      properties: {
        title: { type: 'string', title: 'Title', 'x-expression': true },
        description: { type: 'string', title: 'Introduction', 'x-expression': true, 'x-widget': 'textarea' },
        content: { type: 'string', title: 'Content (summary, terms)', description: '**bold**, line breaks and {{templates}}', 'x-expression': true, 'x-widget': 'textarea' },
        stage: { type: 'string', title: 'Stage', description: 'the journey stage this screen belongs to (progress bar)' },
        fields: { type: 'array', title: 'Fields', items: FIELD_ITEM },
        buttons: { type: 'array', title: 'Buttons', items: BUTTON_ITEM, minItems: 1 },
        autoSubmit: {
          type: 'object', title: 'Continue by itself',
          description: 'press a button without the client: e.g. as soon as a QR code is scanned',
          properties: {
            button: { type: 'string', title: 'Button (event)', description: 'e.g. continue' },
            when: { type: 'string', title: 'When', default: 'complete', enum: ['complete', 'expression'], 'x-enum-labels': ['Every required field is filled and valid', 'Valid, and a rule over the answers holds'] },
            expression: { 'x-show-if': { when: ['expression'] }, type: 'string', title: 'Rule', description: 'JSONata over the answers (scanned codes also as <key>Details), e.g. codeDetails.valid and $exists(codeDetails.amount)' },
            delay: { type: 'number', title: 'Countdown (seconds)', description: '0: at once; otherwise the client sees it coming and can stop it' },
          },
        },
        expiresAfter: { type: 'string', title: 'Expire after', 'x-widget': 'duration' },
      },
    },
    defaults: { title: 'Tell us about you', fields: [{ key: 'fullName', label: 'Full name', type: 'text', required: true, default: '{{me.name}}' }], buttons: [{ key: 'continue', label: 'Continue', style: 'primary' }] },
    summary: '{{title}}',
    events: { static: ['expired'], fromConfig: 'buttons', defaults: ['continue'] },
  },
  resolveConfig: false,
  validate: (config) => {
    const errors: string[] = [];
    if (!Array.isArray(config.buttons) || !config.buttons.length) errors.push('needs at least one button');
    const keys = new Set<string>();
    for (const field of Array.isArray(config.fields) ? config.fields : []) {
      if (!field?.key || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(field.key)) errors.push(`field "${field?.label ?? '?'}" needs a key (letters, digits, _)`);
      if (keys.has(field?.key)) errors.push(`field key "${field.key}" is used twice`);
      keys.add(field?.key);
      if (!SCREEN_FIELD_TYPES.includes(field?.type ?? 'text')) errors.push(`field "${field.key}": unknown type ${field.type}`);
      if (['select', 'choice'].includes(field?.type) && !field.options?.length && !field.optionsFrom) errors.push(`field "${field.key}" needs options`);
      if (field?.type === 'display' && !field.expression) errors.push(`field "${field.key}": a calculated value needs an expression`);
      for (const [name, source] of [['visibleIf', field?.visibleIf], ['expression', field?.expression]] as const) {
        if (!source) continue;
        try { jsonata(String(source).replace(/^\s*=/, '')); } catch (error) { errors.push(`field "${field.key}": ${name} is not valid JSONata (${(error as Error).message})`); }
      }
      if (field?.pattern) {
        try { new RegExp(String(field.pattern)); } catch { errors.push(`field "${field.key}": the pattern is not a valid regular expression`); }
      }
    }
    const auto = config.autoSubmit;
    if (auto?.button) {
      if (!(Array.isArray(config.buttons) ? config.buttons : []).some((b: { key?: string }) => b?.key === auto.button)) errors.push(`continues by itself with "${auto.button}", which is not one of its buttons`);
      if (auto.when === 'expression') {
        if (!auto.expression) errors.push('continues by itself on a rule, but the rule is empty');
        else try { jsonata(String(auto.expression)); } catch (error) { errors.push(`the rule to continue by itself is not valid JSONata (${(error as Error).message})`); }
      }
    }
    return errors;
  },
  async execute({ ctx, step, label, tenantId, caseId, vars, deps }) {
    const taskId = ctx.rand.uuidv4();
    const screen = await ctx.run(`screen-${label}`, async () => {
      const kase = (await deps.repository.getCase(tenantId, caseId))!;
      if (!kase.applicantId) throw new restate.TerminalError('A client screen needs a case with an applicant');
      const db = deps.repository.db(tenantId);
      const me = await loadMe(db, kase.applicantId);
      const scope = { ...vars, me };
      const config = step.config as Record<string, any>;
      const definition = await buildScreen(step, scope, vars, (collection) => listRecords(db, kase.applicantId!, collection));
      const expires = durationMs(config.expiresAfter);
      await deps.repository.createTask(tenantId, {
        id: taskId, caseId, stepId: step.id, audience: 'client', kind: 'screen', title: definition.title,
        description: definition.description ?? null, assigneeId: kase.applicantId, screen: definition as unknown as Record<string, unknown>,
        // File fields take uploads through the normal intake (scan, sanitise) addressed to this task and field.
        requestItems: definition.fields.filter((f) => f.type === 'file' || f.type === 'signature').map((f) => ({ key: f.key, label: f.label, type: 'file' as const })),
        dueAt: expires ? new Date(Date.now() + expires) : null,
      });
      await deps.repository.updateCase(tenantId, caseId, { status: 'pending_client' });
      return definition;
    });

    const promise = ctx.promise<TaskSignal>(`task:${taskId}`);
    const expireMs = durationMs((step.config as Record<string, any>).expiresAfter);
    let signal: TaskSignal;
    try {
      signal = expireMs ? await promise.get().orTimeout(expireMs) : await promise.get();
    } catch (error) {
      if (!(error instanceof restate.TimeoutError)) throw error;
      await ctx.run(`screen-expired-${label}`, async () => {
        await deps.repository.updateTask(tenantId, taskId, { status: 'expired' });
        await deps.audit.record(tenantId, WORKFLOW_ACTOR, 'client_request.expired', { type: 'task', id: taskId }, {}, caseId);
      });
      return { event: 'expired', output: { expired: true } };
    }
    const values = (signal.response ?? {}) as Record<string, unknown>;
    // The answers become part of the application (input.<key>), for the next steps and for the team.
    vars.input = { ...(vars.input ?? {}), ...values };
    await ctx.run(`screen-saved-${label}`, async () => {
      const kase = (await deps.repository.getCase(tenantId, caseId))!;
      await deps.repository.updateCase(tenantId, caseId, { data: { ...kase.data, ...values }, status: 'in_progress' });
    });
    return { event: signal.outcome, output: { values, button: signal.outcome, title: screen.title } };
  },
};

/**
 * A screen for the team (docs/plans/16 §5.6): the same fields and buttons as a client screen, filled by a member. Without
 * a role it is a wizard for the member who started the case (a back-office action opens it at once, in a dialog); with
 * `to.role` it is a form task in that role's queue. The scope has `member` (who started the case) and `client` (the
 * applicant, when there is one). The output says who answered (`by`, with their attributes) for the next steps, e.g. a
 * condition on `steps.<id>.by.attributes.authorityLimit`.
 */
const teamScreen: EngineComponent = {
  definition: {
    type: 'team.screen', version: 1, title: 'Team screen',
    description: 'A screen for the team: the member who started the case fills it (a wizard), or a role queue does. Each button is an event; the answers become input.<key>.',
    icon: 'PanelsTopLeft', category: 'people', kind: 'human', source: { kind: 'builtin' },
    configSchema: {
      ...clientScreen.definition.configSchema,
      properties: {
        ...clientScreen.definition.configSchema.properties,
        to: {
          type: 'object', title: 'Who fills it',
          description: 'empty: the member who started the case, at once; a role: a task in its queue',
          properties: { role: { type: 'string', title: 'Role queue', 'x-widget': 'role', 'x-expression': true } },
        },
      },
    },
    defaults: {
      title: 'Details', fields: [{ key: 'reason', label: 'Reason', type: 'textarea', required: true }],
      buttons: [{ key: 'continue', label: 'Continue', style: 'primary' }, { key: 'cancel', label: 'Cancel', style: 'secondary', skipValidation: true }],
    },
    summary: '{{title}}',
    events: { static: ['expired'], fromConfig: 'buttons', defaults: ['continue'] },
  },
  resolveConfig: false,
  validate: (config, context) => {
    const errors = clientScreen.validate!(config, context);
    const role = config.to?.role;
    if (role && !String(role).trim().startsWith('=') && context.roles && !context.roles.includes(role)) errors.push(`routes to unknown role "${role}"`);
    return errors;
  },
  async execute({ ctx, step, label, tenantId, caseId, vars, deps }) {
    const taskId = ctx.rand.uuidv4();
    const config = step.config as Record<string, any>;
    const screen = await ctx.run(`team-screen-${label}`, async () => {
      const kase = (await deps.repository.getCase(tenantId, caseId))!;
      const db = deps.repository.db(tenantId);
      const role = config.to?.role ? String(await resolveConfig(config.to.role, vars) ?? '').trim() : '';
      if (!role && (kase.initiatedByType !== 'member' || !kase.initiatedById)) {
        throw new restate.TerminalError('A team screen without a role needs a case started by a member');
      }
      const [starter] = kase.initiatedByType === 'member' && kase.initiatedById
        ? await db.select({ id: users.id, email: users.email, name: users.name, attributes: users.attributes }).from(users).where(eq(users.id, kase.initiatedById)).limit(1)
        : [];
      const client = kase.applicantId ? await loadMe(db, kase.applicantId) : null;
      const scope = { ...vars, member: starter ?? null, client };
      const definition = await buildScreen(step, scope, vars, async (collection) => (kase.applicantId ? listRecords(db, kase.applicantId, collection) : []));
      const expires = durationMs(config.expiresAfter);
      await deps.repository.createTask(tenantId, {
        id: taskId, caseId, stepId: step.id, audience: 'member', kind: 'screen', title: definition.title,
        description: definition.description ?? null, screen: definition as unknown as Record<string, unknown>,
        ...(role ? { queueRole: role } : { assigneeId: kase.initiatedById, status: 'claimed' as const }),
        outcomes: definition.buttons.map((b) => ({ key: b.key, label: b.label, requiresReason: false, needsSecondApproval: false })),
        requestItems: definition.fields.filter((f) => f.type === 'file' || f.type === 'signature').map((f) => ({ key: f.key, label: f.label, type: 'file' as const })),
        dueAt: expires ? new Date(Date.now() + expires) : null,
      });
      await deps.audit.record(tenantId, WORKFLOW_ACTOR, 'task.created', { type: 'task', id: taskId, title: definition.title }, { kind: 'screen', ...(role ? { queue: role } : { assignee: starter?.email }) }, caseId);
      return definition;
    });

    const promise = ctx.promise<TaskSignal>(`task:${taskId}`);
    const expireMs = durationMs(config.expiresAfter);
    let signal: TaskSignal;
    try {
      signal = expireMs ? await promise.get().orTimeout(expireMs) : await promise.get();
    } catch (error) {
      if (!(error instanceof restate.TimeoutError)) throw error;
      await ctx.run(`team-screen-expired-${label}`, async () => {
        await deps.repository.updateTask(tenantId, taskId, { status: 'expired' });
        await deps.audit.record(tenantId, WORKFLOW_ACTOR, 'task.expired', { type: 'task', id: taskId }, {}, caseId);
      });
      return { event: 'expired', output: { expired: true } };
    }
    const values = (signal.response ?? {}) as Record<string, unknown>;
    vars.input = { ...(vars.input ?? {}), ...values };
    const by = await ctx.run(`team-screen-saved-${label}`, async () => {
      const kase = (await deps.repository.getCase(tenantId, caseId))!;
      await deps.repository.updateCase(tenantId, caseId, { data: { ...kase.data, ...values } });
      const [member] = signal.by?.id
        ? await deps.repository.db(tenantId).select({ id: users.id, email: users.email, name: users.name, attributes: users.attributes }).from(users).where(eq(users.id, signal.by.id)).limit(1)
        : [];
      return member ?? { id: signal.by?.id ?? null, email: signal.by?.email ?? null, name: null, attributes: {} };
    });
    return { event: signal.outcome, output: { values, button: signal.outcome, title: screen.title, by } };
  },
};

const clientData: EngineComponent = {
  definition: {
    type: 'client.data', version: 1, title: 'Read client data', description: "Loads records of the client (accounts, cards…) for the next steps: steps.<id>.records, .first, .count.",
    icon: 'DatabaseZap', category: 'data', kind: 'automatic', source: { kind: 'builtin' },
    configSchema: {
      type: 'object', required: ['collection'],
      properties: {
        collection: { type: 'string', title: 'Collection', description: 'e.g. accounts' },
        filter: { type: 'string', title: 'Filter', description: 'JSONata over each record, e.g. status = "active"' },
        client: { type: 'string', title: 'Client', description: 'user id of another client (e.g. = steps.borrower.clientId); default: the applicant', 'x-expression': true },
      },
    },
    defaults: { collection: 'accounts' },
    summary: 'Loads {{collection}}',
    events: { static: ['done'] },
  },
  resolveConfig: false,
  validate: (config) => (config.collection ? [] : ['needs a collection']),
  async execute({ ctx, step, label, vars, tenantId, caseId, deps }) {
    const output = await ctx.run(`client-data-${label}`, async () => {
      const kase = (await deps.repository.getCase(tenantId, caseId))!;
      const clientId = step.config.client ? String(await resolveConfig(step.config.client, vars) ?? '') : kase.applicantId;
      if (!clientId) return { records: [], first: null, count: 0 };
      const all = await listRecords(deps.repository.db(tenantId), clientId, String(step.config.collection));
      const records = [];
      for (const item of all) if (await evalItem(step.config.filter, item, true)) records.push(item);
      return { records, first: records[0] ?? null, count: records.length };
    });
    return { event: 'done', output };
  },
};

const clientRecord: EngineComponent = {
  definition: {
    type: 'client.record', version: 1, title: 'Write client data', description: 'Creates or updates a record the client sees in their app (an account, a card, a transaction…).',
    icon: 'DatabaseBackup', category: 'data', kind: 'automatic', source: { kind: 'builtin' },
    configSchema: {
      type: 'object', required: ['collection', 'key'],
      properties: {
        collection: { type: 'string', title: 'Collection', description: 'e.g. accounts' },
        key: { type: 'string', title: 'Record key', description: 'e.g. {{input.card}}', 'x-expression': true },
        mode: { type: 'string', title: 'Mode', enum: ['upsert', 'merge'], 'x-enum-labels': ['Create or replace', 'Update these fields'] },
        data: { type: 'object', title: 'Fields', description: 'name → value, =JSONata or {{template}}', 'x-widget': 'keyValue', additionalProperties: { type: 'string' } },
        client: { type: 'string', title: 'Client', description: 'user id of another client (e.g. = steps.borrower.clientId); default: the applicant', 'x-expression': true },
      },
    },
    defaults: { collection: 'accounts', key: '{{input.account}}', mode: 'merge', data: { status: 'active' } },
    summary: '{{mode}} {{collection}}',
    events: { static: ['done'] },
  },
  validate: (config) => (config.collection && config.key ? [] : ['needs a collection and a key']),
  async execute({ ctx, label, config, tenantId, caseId, deps }) {
    const output = await ctx.run(`client-record-${label}`, async () => {
      const kase = (await deps.repository.getCase(tenantId, caseId))!;
      const clientId = await targetClient(deps, tenantId, config.client, kase.applicantId);
      if (!clientId) throw new restate.TerminalError('Writing client data needs a client (the applicant or the client field)');
      const record = await writeRecord(deps.repository.db(tenantId), {
        clientId, collection: String(config.collection), key: String(config.key),
        data: (config.data ?? {}) as Record<string, unknown>, source: `workflow:${kase.reference}`, mode: config.mode === 'upsert' ? 'upsert' : 'merge',
      });
      await deps.audit.record(tenantId, WORKFLOW_ACTOR, 'client_record.written', { type: 'client_record', id: `${config.collection}/${config.key}` }, { mode: config.mode ?? 'merge' }, caseId);
      return record;
    });
    return { event: 'done', output };
  },
};

const clientProfile: EngineComponent = {
  definition: {
    type: 'client.profile', version: 1, title: 'Update client profile', description: 'Sets profile attributes (e.g. KYC level, address) and segments (e.g. customer) of the client.',
    icon: 'UserRoundPen', category: 'client', kind: 'automatic', source: { kind: 'builtin' },
    configSchema: {
      type: 'object',
      properties: {
        attributes: { type: 'object', title: 'Attributes', description: 'name → value, =JSONata or {{template}}', 'x-widget': 'keyValue', additionalProperties: { type: 'string' } },
        addSegments: { type: 'array', title: 'Add segments', items: { type: 'string' } },
        removeSegments: { type: 'array', title: 'Remove segments', items: { type: 'string' } },
        client: { type: 'string', title: 'Client', description: 'user id of another client (e.g. = steps.borrower.clientId); default: the applicant', 'x-expression': true },
      },
    },
    defaults: { attributes: {}, addSegments: [] },
    summary: 'Segments +{{addSegments}}',
    events: { static: ['done'] },
  },
  async execute({ ctx, label, config, tenantId, caseId, deps }) {
    const output = await ctx.run(`client-profile-${label}`, async () => {
      const kase = (await deps.repository.getCase(tenantId, caseId))!;
      const clientId = await targetClient(deps, tenantId, config.client, kase.applicantId);
      if (!clientId) throw new restate.TerminalError('Updating a profile needs a client (the applicant or the client field)');
      const row = await updateProfile(deps.repository.db(tenantId), clientId, {
        attributes: (config.attributes ?? {}) as Record<string, unknown>,
        addSegments: Array.isArray(config.addSegments) ? config.addSegments.map(String) : [],
        removeSegments: Array.isArray(config.removeSegments) ? config.removeSegments.map(String) : [],
      });
      await deps.audit.record(tenantId, WORKFLOW_ACTOR, 'client_profile.updated', { type: 'user', id: clientId }, { attributes: Object.keys(config.attributes ?? {}), segments: row.segments }, caseId);
      return { attributes: row.attributes, segments: row.segments };
    });
    return { event: 'done', output };
  },
};

const clientNotify: EngineComponent = {
  definition: {
    type: 'client.notify', version: 1, title: 'Notify client', description: 'A notification in the client\'s app (and by e-mail if you want), optionally opening a page.',
    icon: 'BellRing', category: 'communication', kind: 'automatic', source: { kind: 'builtin' },
    configSchema: {
      type: 'object', required: ['title'],
      properties: {
        title: { type: 'string', title: 'Title', 'x-expression': true },
        body: { type: 'string', title: 'Message', 'x-expression': true, 'x-widget': 'textarea' },
        tone: { type: 'string', title: 'Tone', enum: ['info', 'success', 'warning'], 'x-enum-labels': ['Information', 'Good news', 'Attention'] },
        page: { type: 'string', title: 'Opens page' },
        params: { type: 'object', title: 'Page parameters', 'x-widget': 'keyValue', additionalProperties: { type: 'string' } },
        email: { type: 'boolean', title: 'Also send an e-mail' },
        client: { type: 'string', title: 'Client', description: 'user id of another client; default: the applicant', 'x-expression': true },
      },
    },
    defaults: { title: 'Update on your request', tone: 'info', email: false },
    summary: '{{title}}',
    events: { static: ['done'] },
  },
  validate: (config) => (config.title ? [] : ['needs a title']),
  async execute({ ctx, label, config, tenantId, caseId, deps }) {
    await ctx.run(`client-notify-${label}`, async () => {
      const kase = (await deps.repository.getCase(tenantId, caseId))!;
      const clientId = await targetClient(deps, tenantId, config.client, kase.applicantId);
      if (!clientId) return;
      const other = clientId !== kase.applicantId ? await deps.repository.userById(tenantId, clientId) : null;
      const email = other ? other.email : kase.applicantEmail;
      const params = Object.fromEntries(Object.entries((config.params ?? {}) as Record<string, unknown>).map(([k, v]) => [k, String(v)]));
      await notify(deps.repository.db(tenantId), {
        clientId, title: String(config.title), body: config.body ? String(config.body) : null, tone: config.tone ? String(config.tone) : 'info',
        // The case rides along: the journey shows its last message when it ends (e.g. "Card frozen").
        link: config.page ? { page: String(config.page), params, ...(other ? {} : { caseId }) } : other ? null : { caseId },
      });
      if (config.email && email) {
        const tenant = await deps.loadTenant(tenantId);
        await deps.notifier.send(tenant, email, String(config.title), String(config.body ?? '').split(/\n{2,}/).filter(Boolean), { label: 'Open the app', url: deps.notifier.portalUrl(tenant) });
      }
    });
    return { event: 'done', output: { notified: true } };
  },
};

/**
 * Find or create a client (e.g. the borrower of a deal a dealer submitted): by its identifier in another system
 * (`source` + `externalId`), else by e-mail; sets the name, attributes and segments, and invites them by e-mail to
 * their app. Later steps act on them with the `client` field (`= steps.<id>.clientId`).
 */
const clientUpsert: EngineComponent = {
  definition: {
    type: 'client.upsert', version: 1, title: 'Create or find a client', description: 'Registers a person as a client of the institution (e.g. the borrower of a deal) and can invite them to the app.',
    icon: 'UserRoundPlus', category: 'client', kind: 'automatic', source: { kind: 'builtin' },
    configSchema: {
      type: 'object', required: ['email'],
      properties: {
        email: { type: 'string', title: 'E-mail', 'x-expression': true },
        name: { type: 'string', title: 'Name', 'x-expression': true },
        externalId: { type: 'string', title: 'Identifier in another system', description: 'e.g. the loan system customer id', 'x-expression': true },
        source: { type: 'string', title: 'That system', description: 'e.g. loanpro (default: workflow)' },
        attributes: { type: 'object', title: 'Profile attributes', 'x-widget': 'keyValue', additionalProperties: { type: 'string' } },
        addSegments: { type: 'array', title: 'Segments', items: { type: 'string' }, description: 'e.g. borrower' },
        invite: { type: 'boolean', title: 'Invite new clients by e-mail to the app', description: 'only when the client is created here' },
        inviteMessage: { type: 'string', title: 'Invitation text', 'x-widget': 'textarea', 'x-expression': true },
      },
    },
    defaults: { email: '{{input.buyerEmail}}', name: '{{input.buyerName}}', addSegments: ['borrower'], invite: true },
    summary: 'Client {{email}}',
    events: { static: ['created', 'existing'] },
  },
  validate: (config) => (config.email ? [] : ['needs an e-mail']),
  async execute({ ctx, label, config, tenantId, caseId, deps }) {
    const result = await ctx.run(`client-upsert-${label}`, async () => {
      const db = deps.repository.db(tenantId);
      const email = String(config.email ?? '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new restate.TerminalError(`"${email}" is not an e-mail address`);
      const source = String(config.source || 'workflow');
      const externalId = config.externalId ? String(config.externalId) : null;
      let user = externalId ? (await db.select({ user: users }).from(clientProfiles).innerJoin(users, eq(users.id, clientProfiles.userId))
        .where(and(eq(clientProfiles.externalSource, source), eq(clientProfiles.externalId, externalId))).limit(1))[0]?.user : undefined;
      user ??= (await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1))[0];
      if (user && user.kind !== 'client') throw new restate.TerminalError(`${email} belongs to a member of the institution`);
      const created = !user;
      if (!user) [user] = await db.insert(users).values({ email, name: String(config.name || email), kind: 'client', status: 'active' }).returning();
      await ensureProfile(db, user.id);
      await updateProfile(db, user.id, {
        attributes: (config.attributes ?? {}) as Record<string, unknown>,
        addSegments: Array.isArray(config.addSegments) ? config.addSegments.map(String) : [],
        ...(externalId ? { externalSource: source, externalId } : {}),
      });
      await deps.audit.record(tenantId, WORKFLOW_ACTOR, created ? 'client.registered' : 'client_profile.updated', { type: 'user', id: user.id, email: user.email }, { method: 'workflow', source, externalId }, caseId);
      // New clients only: existing ones already know how to sign in (tell them with client.notify).
      if (config.invite && created) {
        const tenant = await deps.loadTenant(tenantId);
        const text = String(config.inviteMessage || `${tenant.name} opened an account for you. Sign in with this e-mail address to see it.`);
        await deps.notifier.send(tenant, user.email, `Your account with ${tenant.name}`, text.split(/\n{2,}/).filter(Boolean), { label: 'Open my account', url: deps.notifier.portalUrl(tenant) });
      }
      return { clientId: user.id, email: user.email, name: user.name, created };
    });
    return { event: result.created ? 'created' : 'existing', output: result };
  },
};

/** The client a step acts on: `client` (a user id of a client of this institution) or the case's applicant. */
async function targetClient(deps: Parameters<EngineComponent['execute']>[0]['deps'], tenantId: string, client: unknown, applicantId: string | null) {
  if (client === undefined || client === null || client === '') return applicantId;
  const id = String(client);
  const user = /^[0-9a-f-]{36}$/i.test(id) ? await deps.repository.userById(tenantId, id) : null;
  if (!user || user.kind !== 'client') throw new restate.TerminalError(`"${id}" is not a client of this institution`);
  return user.id;
}

export const CLIENT_APP_COMPONENTS: EngineComponent[] = [clientScreen, teamScreen, clientData, clientRecord, clientProfile, clientNotify, clientUpsert];
