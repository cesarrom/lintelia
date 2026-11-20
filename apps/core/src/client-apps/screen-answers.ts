import jsonata from 'jsonata';
import { and, eq, inArray } from 'drizzle-orm';
import { parsePaymentCode, VALUE_CHECKS } from '@repo/lintelia/utilities';
import { caseFiles } from '../entities';
import type { TenantDatabase } from '../clients/database.client';
import type { ScreenDefinition } from '../engine/components/client-app';
import { UnprocessableError } from '../http/errors';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The answers of a screen (`client.screen` or `team.screen`), checked as the app checks them: required fields, types,
 * options, ranges, patterns, value checks, codes, uploaded files (addressed to the task, by the person answering).
 * Fields hidden by their condition are ignored. Buttons that skip validation only keep what parses.
 */
export async function checkScreenAnswers(db: TenantDatabase, screen: ScreenDefinition, button: ScreenDefinition['buttons'][number], raw: Record<string, unknown>, opts: { taskId: string; uploaderId: string }) {
  const strict = !button.skipValidation;
  
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
        const files = await db.select().from(caseFiles).where(and(inArray(caseFiles.id, ids), eq(caseFiles.taskId, opts.taskId), eq(caseFiles.itemKey, field.key), eq(caseFiles.uploadedById, opts.uploaderId)));
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
  return values;
}
