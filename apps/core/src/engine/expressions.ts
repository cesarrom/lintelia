import jsonata from 'jsonata';
import { get } from 'lodash';

/**
 * Expressions in workflow definitions:
 *  - a config string starting with `=` is a JSONata expression (`= input.amount > 50000 ? 'high' : 'standard'`);
 *    JSONata is a safe, side-effect-free query language (also used by AWS Step Functions), never `eval`;
 *  - `{{ path }}` inside text interpolates a value (`{{input.fullName}}`, `{{steps.estimate.maxAmount}}`);
 *  - a string that is exactly one `{{ path }}` resolves to the raw value (number, object...);
 *  - a format after a pipe: `{{ steps.offer.monthly | money }}` → `1,234.50`; `| number`, `| date`, `| upper`.
 */
export async function evaluate(expression: string, vars: Record<string, unknown>): Promise<unknown> {
  const source = expression.trim().replace(/^=/, '');
  return jsonata(source).evaluate(vars);
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const display = (value: unknown) => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const FORMATS: Record<string, (value: unknown) => string> = {
  money: (value) => (Number.isFinite(Number(value)) && value !== '' && value !== null ? Number(value).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : display(value)),
  number: (value) => (Number.isFinite(Number(value)) && value !== '' && value !== null ? Number(value).toLocaleString('en-GB', { maximumFractionDigits: 2 }) : display(value)),
  date: (value) => {
    const date = new Date(String(value));
    return value && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : display(value);
  },
  upper: (value) => display(value).toUpperCase(),
};

/** `path` or `path | format`. */
function placeholder(expression: string, vars: Record<string, unknown>): string {
  const [path, format] = expression.split('|').map((part) => part.trim());
  const value = get(vars, path);
  return format && FORMATS[format] ? FORMATS[format](value) : display(value);
}

export function interpolate(template: string, vars: Record<string, unknown>, options: { html?: boolean } = {}): string {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, expression: string) => {
    const text = placeholder(expression, vars);
    return options.html ? escapeHtml(text) : text;
  });
}

/** Resolve every string in a config object (expressions and interpolation). */
export async function resolveConfig<T>(value: T, vars: Record<string, unknown>): Promise<T> {
  if (typeof value === 'string') {
    if (value.trim().startsWith('=')) return (await evaluate(value, vars)) as T;
    const single = value.match(/^\{\{\s*([^}|]+?)\s*\}\}$/);
    if (single) return get(vars, single[1]) as T;
    return interpolate(value, vars) as T;
  }
  if (Array.isArray(value)) return Promise.all(value.map((item) => resolveConfig(item, vars))) as Promise<T>;
  if (value && typeof value === 'object') {
    const entries = await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await resolveConfig(item, vars)] as const));
    return Object.fromEntries(entries) as T;
  }
  return value;
}
