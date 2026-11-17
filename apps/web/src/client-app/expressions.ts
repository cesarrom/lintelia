import jsonata from 'jsonata';
import { useEffect, useRef, useState } from 'react';

/**
 * Expressions of client apps (docs/plans/11 §2.2), evaluated in the browser for display only — what a client may
 * read was already decided by the API (data allow-list), and what they may do is checked again by the API.
 *  - `= <JSONata>`: an expression, e.g. `= $sum(records.accounts.balance)`;
 *  - `{{ path }}` inside text: a template, e.g. `Hello {{me.firstName}}`;
 *  - anything else: a literal.
 * Page expressions read the page scope (`me`, `records`, `cases`, `requests`, `notifications`, `journeys`, `params`).
 * Item expressions (list filters, item titles…) read the item itself, plus `item`, `me`, `records`, `params`; the
 * same names are bound as variables (`$params.key`, `$records.transactions`).
 */

export type Scope = Record<string, unknown>;

const compiled = new Map<string, ReturnType<typeof jsonata> | null>();

function compile(expression: string) {
  if (!compiled.has(expression)) {
    try {
      compiled.set(expression, jsonata(expression));
    } catch {
      compiled.set(expression, null);
    }
    if (compiled.size > 2000) compiled.delete(compiled.keys().next().value!);
  }
  return compiled.get(expression) ?? null;
}

const bindingsOf = (scope: Scope) => ({ me: scope.me, records: scope.records, params: scope.params ?? {}, item: scope.item });

/** Evaluate a JSONata expression (leading `=` optional); errors give `undefined`. */
export async function evaluate(expression: string, input: unknown, scope: Scope = {}): Promise<unknown> {
  const source = expression.trim().replace(/^=\s*/, '');
  if (!source) return undefined;
  const compiledExpression = compile(source);
  if (!compiledExpression) return undefined;
  try {
    const value = await compiledExpression.evaluate(input, bindingsOf(scope));
    return unwrap(value);
  } catch {
    return undefined;
  }
}

/** JSONata returns sequences as arrays with a marker; plain copies are easier to render. */
function unwrap(value: unknown): unknown {
  if (Array.isArray(value)) return Array.from(value);
  return value;
}

export const isExpression = (value: unknown): value is string => typeof value === 'string' && value.trim().startsWith('=');

const display = (value: unknown) => (value === undefined || value === null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value));

/** Formats after a pipe, as in workflow templates: `{{ item.balance | money }}`. */
const FORMATS: Record<string, (value: unknown) => string> = {
  money: (v) => (v !== '' && v !== null && Number.isFinite(Number(v)) ? Number(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : display(v)),
  number: (v) => (v !== '' && v !== null && Number.isFinite(Number(v)) ? Number(v).toLocaleString('en-GB', { maximumFractionDigits: 2 }) : display(v)),
  date: (v) => {
    const date = new Date(String(v));
    return v && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : display(v);
  },
  upper: (v) => display(v).toUpperCase(),
};

/** Replace `{{ path }}` placeholders (JSONata over the scope, optionally `| format`). */
export async function renderTemplate(text: string, scope: Scope): Promise<string> {
  if (!text.includes('{{')) return text;
  const parts = text.split(/(\{\{[^}]+\}\})/g);
  const out = await Promise.all(parts.map(async (part) => {
    const match = part.match(/^\{\{\s*([^}]+?)\s*\}\}$/);
    if (!match) return part;
    const pipe = match[1].match(/^(.*)\|\s*([a-z]+)\s*$/);
    const format = pipe && FORMATS[pipe[2]] ? FORMATS[pipe[2]] : null;
    const value = await evaluate(format ? pipe![1] : match[1], scope, scope);
    return format ? format(value) : display(value);
  }));
  return out.join('');
}

/** A prop value: expression, template or literal. */
export async function resolveValue(value: unknown, scope: Scope): Promise<unknown> {
  if (isExpression(value)) return evaluate(value, scope, scope);
  if (typeof value === 'string' && value.includes('{{')) return renderTemplate(value, scope);
  return value;
}

/** The input item expressions see: the item's own fields, plus `item`, `me`, `records`, `params`. */
export function itemInput(item: unknown, scope: Scope): Scope {
  const fields = item && typeof item === 'object' && !Array.isArray(item) ? (item as Scope) : {};
  return { me: scope.me, records: scope.records, params: scope.params, ...fields, item };
}

/** A value computed for an item: `= expr` over the item, a template, or a field name. */
export async function resolveItemValue(value: unknown, item: unknown, scope: Scope): Promise<unknown> {
  const input = itemInput(item, scope);
  const itemScope = { ...scope, item };
  if (isExpression(value)) return evaluate(value, input, itemScope);
  if (typeof value === 'string' && value.includes('{{')) return renderTemplate(value, { ...input, ...itemScope });
  return value;
}

/** Keep the items an item filter (JSONata over each item) accepts. */
export async function filterItems<T>(items: T[], filter: unknown, scope: Scope): Promise<T[]> {
  if (typeof filter !== 'string' || !filter.trim()) return items;
  const keep = await Promise.all(items.map(async (item) => Boolean(await evaluate(filter, itemInput(item, scope), { ...scope, item }))));
  return items.filter((_, i) => keep[i]);
}

/** Resolve every prop of a widget (strings only; nested arrays/objects are left to the widget). */
export async function resolveProps(props: Record<string, unknown>, scope: Scope, keys?: string[]): Promise<Record<string, unknown>> {
  const entries = await Promise.all(Object.entries(props).map(async ([key, value]) => [key, keys && !keys.includes(key) ? value : await resolveValue(value, scope)] as const));
  return Object.fromEntries(entries);
}

/** Run an async computation when its inputs change; `undefined` until the first result. */
export function useAsync<T>(compute: () => Promise<T>, deps: unknown[]): T | undefined {
  const [state, setState] = useState<{ value: T } | undefined>(undefined);
  const generation = useRef(0);
  useEffect(() => {
    const mine = ++generation.current;
    compute().then((value) => {
      if (mine === generation.current) setState({ value });
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state?.value;
}

/** `useAsync` keyed on JSON-comparable inputs (props and the scope change identity on every render). */
export function useResolved<T>(compute: () => Promise<T>, inputs: unknown[]): T | undefined {
  const key = safeKey(inputs);
  return useAsync(compute, [key]);
}

function safeKey(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(Math.random());
  }
}
