/**
 * Payment codes people scan (docs/plans/14): what a QR code says, as data a journey can use — the merchant, the amount,
 * the account. Shared by the client app (a preview as soon as the code is read) and the API (the details a workflow
 * gets, from the raw text it checks again).
 *
 *  - `emv`: EMVCo merchant-presented QR (Pix, Mercado Pago and most "pay with QR" schemes, UPI's EMV form, SGQR…):
 *    TLV fields, nested merchant account templates (26–51), additional data (62), CRC-16 (63) checked;
 *  - `epc`: the European Payments Council's SEPA credit transfer QR ("BCD" lines: name, IBAN, BIC, EUR amount, reference);
 *  - `url`: any URI with parameters (`upi://pay?pa=…&am=…`, `bitcoin:…?amount=`, a web link with a query);
 *  - `json`: a JSON object;
 *  - `raw`: the text as it is (barcodes, references).
 */

export type PaymentCodeFormat = 'auto' | 'emv' | 'epc' | 'url' | 'json' | 'raw';

export interface PaymentCode {
  format: Exclude<PaymentCodeFormat, 'auto'>;
  raw: string;
  /** The code is well formed (EMV: the CRC matches; EPC: the mandatory lines are there). */
  valid: boolean;
  problem?: string;
  /** Who is paid (merchant or beneficiary name). */
  payee?: string;
  city?: string;
  country?: string;
  /** ISO 4217 alphabetic (EUR, BRL…) when known. */
  currency?: string;
  /** Requested amount, when the code fixes one. */
  amount?: number;
  /** Account the money goes to (IBAN, Pix key, UPI VPA…). */
  account?: string;
  bic?: string;
  reference?: string;
  /** Merchant category code (EMV). */
  mcc?: string;
  /** `static` (any amount, reusable) or `dynamic` (one payment) — EMV. */
  pointOfInitiation?: 'static' | 'dynamic';
  /** EMV: merchant account templates (tag → GUI and fields). */
  schemes?: Array<{ tag: string; id: string; fields: Record<string, string> }>;
  /** URL: scheme, address and parameters. */
  scheme?: string;
  address?: string;
  params?: Record<string, string>;
  /** JSON: the object. */
  data?: unknown;
}

/** ISO 4217 numeric → alphabetic (the currencies QR payment schemes use most). */
const CURRENCIES: Record<string, string> = {
  '032': 'ARS', '036': 'AUD', '124': 'CAD', '152': 'CLP', '156': 'CNY', '170': 'COP', '208': 'DKK', '344': 'HKD', '356': 'INR', '360': 'IDR',
  '392': 'JPY', '458': 'MYR', '484': 'MXN', '554': 'NZD', '578': 'NOK', '604': 'PEN', '608': 'PHP', '702': 'SGD', '704': 'VND', '710': 'ZAR',
  '752': 'SEK', '756': 'CHF', '764': 'THB', '826': 'GBP', '840': 'USD', '858': 'UYU', '949': 'TRY', '978': 'EUR', '985': 'PLN', '986': 'BRL',
};
const NUMERIC = Object.fromEntries(Object.entries(CURRENCIES).map(([n, a]) => [a, n]));

/** CRC-16/CCITT-FALSE, as EMV QR codes use it (poly 0x1021, init 0xFFFF), uppercase hex. */
export function crc16(text: string) {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(text)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function tlv(text: string): Array<{ tag: string; value: string }> | null {
  const out: Array<{ tag: string; value: string }> = [];
  let i = 0;
  while (i < text.length) {
    const tag = text.slice(i, i + 2);
    const length = Number(text.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(tag) || !Number.isInteger(length) || i + 4 + length > text.length) return null;
    out.push({ tag, value: text.slice(i + 4, i + 4 + length) });
    i += 4 + length;
  }
  return out;
}

function parseEmv(raw: string): PaymentCode {
  const fields = tlv(raw);
  if (!fields) return { format: 'emv', raw, valid: false, problem: 'not a valid EMV QR code (malformed fields)' };
  const get = (tag: string) => fields.find((f) => f.tag === tag)?.value;
  const crcIndex = raw.lastIndexOf('6304');
  const crcOk = crcIndex >= 0 && crcIndex === raw.length - 8 && crc16(raw.slice(0, crcIndex + 4)) === raw.slice(crcIndex + 4).toUpperCase();
  const schemes = fields.filter((f) => Number(f.tag) >= 26 && Number(f.tag) <= 51).map((f) => {
    const inner = tlv(f.value) ?? [];
    const id = inner.find((x) => x.tag === '00')?.value ?? '';
    return { tag: f.tag, id, fields: Object.fromEntries(inner.filter((x) => x.tag !== '00').map((x) => [x.tag, x.value])) };
  });
  const additional = tlv(get('62') ?? '') ?? [];
  const extra = (tag: string) => additional.find((x) => x.tag === tag)?.value;
  const amount = get('54');
  const numericCurrency = get('53');
  // The account: the first merchant account template's key (Pix: 01; most others: 01 or 02).
  const account = schemes[0] ? schemes[0].fields['01'] ?? schemes[0].fields['02'] : undefined;
  return {
    format: 'emv', raw, valid: crcOk && get('00') === '01', problem: crcOk ? undefined : 'the code is damaged (checksum does not match)',
    payee: get('59'), city: get('60'), country: get('58'), mcc: get('52'),
    currency: numericCurrency ? CURRENCIES[numericCurrency] ?? numericCurrency : undefined,
    amount: amount !== undefined && amount !== '' && Number.isFinite(Number(amount)) ? Number(amount) : undefined,
    pointOfInitiation: get('01') === '12' ? 'dynamic' : get('01') === '11' ? 'static' : undefined,
    account, reference: extra('05') ?? extra('01'), schemes,
  };
}

function parseEpc(raw: string): PaymentCode {
  const lines = raw.split(/\r?\n/);
  const [service, version, , identification, bic, name, iban, amountLine, , structured, text] = lines;
  const valid = service === 'BCD' && ['001', '002'].includes(version ?? '') && identification === 'SCT' && !!name && !!iban;
  const amount = /^EUR(\d+(?:\.\d{1,2})?)$/.exec(amountLine ?? '')?.[1];
  return {
    format: 'epc', raw, valid, problem: valid ? undefined : 'not a complete SEPA credit transfer code',
    payee: name || undefined, account: iban?.replace(/\s+/g, '') || undefined, bic: bic || undefined, currency: 'EUR',
    amount: amount ? Number(amount) : undefined, reference: structured || text || undefined,
  };
}

function parseUrl(raw: string): PaymentCode {
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(raw)?.[1]?.toLowerCase();
  if (!scheme) return { format: 'url', raw, valid: false, problem: 'not an address' };
  const rest = raw.slice(scheme.length + 1);
  const [pathPart, query = ''] = rest.split('?');
  const params = Object.fromEntries(new URLSearchParams(query).entries());
  const address = pathPart.replace(/^\/\//, '');
  const amount = params.am ?? params.amount;
  return {
    format: 'url', raw, valid: true, scheme, address, params,
    payee: params.pn ?? params.name ?? params.label, account: params.pa ?? (scheme === 'bitcoin' ? address : undefined),
    amount: amount && Number.isFinite(Number(amount)) ? Number(amount) : undefined, currency: params.cu ?? params.currency,
    reference: params.tr ?? params.tn ?? params.message ?? params.reference,
  };
}

/** What a scanned code says. `auto` recognises EMV, EPC, URIs and JSON; anything else is `raw`. */
export function parsePaymentCode(input: string, format: PaymentCodeFormat = 'auto'): PaymentCode {
  const raw = String(input ?? '').trim();
  const detected: Exclude<PaymentCodeFormat, 'auto'> = format !== 'auto' ? format
    : raw.startsWith('BCD\n') || raw.startsWith('BCD\r\n') ? 'epc'
      : /^000201/.test(raw) ? 'emv'
        : /^\s*[{[]/.test(raw) ? 'json'
          : /^[a-z][a-z0-9+.-]*:\S/i.test(raw) ? 'url' : 'raw';
  switch (detected) {
    case 'emv': return parseEmv(raw);
    case 'epc': return parseEpc(raw);
    case 'url': return parseUrl(raw);
    case 'json':
      try {
        return { format: 'json', raw, valid: true, data: JSON.parse(raw) };
      } catch {
        return { format: 'json', raw, valid: false, problem: 'not valid JSON' };
      }
    default:
      return { format: 'raw', raw, valid: raw.length > 0 };
  }
}

const field = (tag: string, value: string) => `${tag}${String(value.length).padStart(2, '0')}${value}`;

/**
 * An EMV merchant-presented payload (what a "receive money" QR shows): the account template (`gui` + `account`, e.g.
 * `br.gov.bcb.pix` + a Pix key), name, city, optional amount and reference; the CRC is added.
 */
export function buildEmvPayload(input: { gui: string; account: string; name: string; city: string; country?: string; currency?: string; amount?: number | string; reference?: string; mcc?: string }) {
  const currency = input.currency ? (/^\d{3}$/.test(input.currency) ? input.currency : NUMERIC[input.currency.toUpperCase()] ?? '986') : '986';
  const amount = input.amount !== undefined && input.amount !== '' && Number(input.amount) > 0 ? Number(input.amount).toFixed(2) : undefined;
  const clean = (s: string, n: number) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, n);
  let payload = field('00', '01')
    + field('01', amount ? '12' : '11')
    + field('26', field('00', input.gui) + field('01', input.account))
    + field('52', input.mcc ?? '0000')
    + field('53', currency)
    + (amount ? field('54', amount) : '')
    + field('58', (input.country ?? 'BR').toUpperCase())
    + field('59', clean(input.name, 25))
    + field('60', clean(input.city, 15))
    + (input.reference ? field('62', field('05', clean(input.reference, 25))) : '');
  payload += '6304';
  return payload + crc16(payload);
}

/** An EPC (SEPA) credit transfer payload. */
export function buildEpcPayload(input: { name: string; iban: string; bic?: string; amount?: number | string; reference?: string }) {
  const amount = input.amount !== undefined && input.amount !== '' && Number(input.amount) > 0 ? `EUR${Number(input.amount).toFixed(2)}` : '';
  return ['BCD', '002', '1', 'SCT', input.bic ?? '', input.name.slice(0, 70), input.iban.replace(/\s+/g, ''), amount, '', '', (input.reference ?? '').slice(0, 140)].join('\n');
}

// --- checks of typed values -------------------------------------------------------------------------------------------------

/** IBAN: country, check digits and the mod-97 test. */
export function isIban(value: string) {
  const iban = value.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const moved = iban.slice(4) + iban.slice(0, 4);
  let rest = 0;
  for (const ch of moved) {
    const digits = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of digits) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest === 1;
}

/** Luhn (card numbers, some IDs). */
export function isLuhn(value: string) {
  const digits = value.replace(/[\s-]+/g, '');
  if (!/^\d{8,19}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

export type ValueCheck = 'iban' | 'luhn' | 'email';
export const VALUE_CHECKS: Record<ValueCheck, { label: string; test: (v: string) => boolean; message: string }> = {
  iban: { label: 'IBAN', test: isIban, message: 'enter a valid IBAN' },
  luhn: { label: 'Card / Luhn number', test: isLuhn, message: 'this number is not valid' },
  email: { label: 'E-mail', test: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), message: 'enter a valid e-mail address' },
};
