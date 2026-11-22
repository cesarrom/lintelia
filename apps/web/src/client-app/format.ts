import { formatRelative } from '@/components/app/page';

export type ValueFormat = 'text' | 'money' | 'number' | 'percent' | 'date' | 'datetime' | 'relative';

/**
 * The app's regional settings (docs/plans/14): its default currency and locale, set by the runtime from the app
 * definition (`currency`, `locale`). Amounts of a record in another currency keep theirs.
 */
const defaults = { currency: 'GBP', locale: undefined as string | undefined };
export function setFormatDefaults(settings: { currency?: string; locale?: string }) {
  defaults.currency = settings.currency && /^[A-Z]{3}$/.test(settings.currency) ? settings.currency : 'GBP';
  defaults.locale = settings.locale || undefined;
}
export const appCurrency = () => defaults.currency;
const appLocale = () => defaults.locale ?? 'en-GB';

const money = new Map<string, Intl.NumberFormat>();
/** Amounts read the way the currency's clients expect ($1,234.50 for USD, not US$1,234.50). */
const CURRENCY_LOCALE: Record<string, string> = { USD: 'en-US', CAD: 'en-CA', AUD: 'en-AU', NZD: 'en-NZ', EUR: 'en-IE', MXN: 'es-MX', BRL: 'pt-BR', ARS: 'es-AR', INR: 'en-IN' };
const localeFor = (code: string) => (defaults.locale && code === defaults.currency ? defaults.locale : CURRENCY_LOCALE[code] ?? defaults.locale ?? 'en-GB');
const moneyFormat = (currency: string) => {
  const code = /^[A-Z]{3}$/.test(currency) ? currency : defaults.currency;
  const key = `${code}|${localeFor(code)}`;
  if (!money.has(key)) money.set(key, new Intl.NumberFormat(localeFor(code), { style: 'currency', currency: code }));
  return money.get(key)!;
};

/** The symbol of a currency as its clients write it ($, £, €, R$…). */
export function currencySymbol(currency = defaults.currency) {
  return moneyFormat(currency).formatToParts(0).find((p) => p.type === 'currency')?.value ?? currency;
}

/** A value for display in the given format (amounts in the record's currency, else the app's). */
export function formatAs(value: unknown, format: string | undefined, currency?: string): string {
  currency = currency || defaults.currency;
  if (value === undefined || value === null || value === '') return '';
  switch (format) {
    case 'money': {
      const n = Number(value);
      return Number.isFinite(n) ? moneyFormat(currency).format(n) : String(value);
    }
    case 'number': {
      const n = Number(value);
      return Number.isFinite(n) ? n.toLocaleString(appLocale(), { maximumFractionDigits: 2 }) : String(value);
    }
    case 'percent': {
      const n = Number(value);
      return Number.isFinite(n) ? `${n.toLocaleString(appLocale(), { maximumFractionDigits: 2 })}%` : String(value);
    }
    case 'date':
    case 'datetime': {
      const date = new Date(String(value));
      if (Number.isNaN(date.getTime())) return String(value);
      return format === 'date'
        ? date.toLocaleDateString(appLocale(), { day: 'numeric', month: 'short', year: 'numeric' })
        : date.toLocaleString(appLocale(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    case 'relative':
      return formatRelative(String(value));
    default:
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
}

/** Day heading for grouped lists: Today, Yesterday, or the date. */
export function dayLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Earlier';
  const today = new Date();
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((start(today) - start(date)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return date.toLocaleDateString(appLocale(), { weekday: 'long', day: 'numeric', month: 'long', ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) });
}
