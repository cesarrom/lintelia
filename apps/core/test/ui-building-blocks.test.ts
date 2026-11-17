import { describe, expect, test } from 'bun:test';
import { buildEmvPayload, buildEpcPayload, crc16, isIban, isLuhn, parsePaymentCode } from '@repo/fintivio/utilities';
import { CLIENT_APP_COMPONENTS } from '../src/engine/components/client-app';

/** UI building blocks (docs/plans/14): payment codes, value checks, and the rules of client.screen's new options. */

describe('payment codes', () => {
  test('an EMV code built here reads back, checksum included', () => {
    const payload = buildEmvPayload({ gui: 'br.gov.bcb.pix', account: 'shop@example.com', name: 'Café Aurora', city: 'São Paulo', currency: 'BRL', amount: 12.5, reference: 'ORDER42' });
    expect(payload.slice(-4)).toBe(crc16(payload.slice(0, -4)));
    const code = parsePaymentCode(payload, 'emv');
    expect(code).toMatchObject({ format: 'emv', valid: true, payee: 'Cafe Aurora', city: 'Sao Paulo', currency: 'BRL', amount: 12.5, account: 'shop@example.com', reference: 'ORDER42' });
  });

  test('a damaged EMV code is refused; auto detects the format', () => {
    const payload = buildEmvPayload({ gui: 'uk.fintivio.demo', account: 'C-1/cur-1', name: 'Corner Shop', city: 'London', country: 'GB', currency: 'GBP' });
    expect(parsePaymentCode(payload, 'auto')).toMatchObject({ format: 'emv', valid: true, currency: 'GBP', country: 'GB' });
    expect(parsePaymentCode(payload, 'auto').amount).toBeUndefined();
    const damaged = payload.replace('Corner', 'Korner');
    expect(parsePaymentCode(damaged, 'emv')).toMatchObject({ valid: false, problem: expect.stringContaining('checksum') });
  });

  test('EPC (SEPA) codes, links and JSON', () => {
    const epc = parsePaymentCode(buildEpcPayload({ name: 'Red Cross', iban: 'BE72 0000 0000 1616', bic: 'BPOTBEB1', amount: 20, reference: 'Donation' }), 'auto');
    expect(epc).toMatchObject({ format: 'epc', valid: true, payee: 'Red Cross', account: 'BE72000000001616', amount: 20, currency: 'EUR' });
    expect(parsePaymentCode('https://pay.example/p?amount=9.90&cu=EUR', 'auto')).toMatchObject({ format: 'url', amount: 9.9 });
    expect(parsePaymentCode('{"amount": 3}', 'json')).toMatchObject({ format: 'json', valid: true });
  });

  test('IBAN and Luhn checks', () => {
    expect(isIban('GB82 WEST 1234 5698 7654 32')).toBe(true);
    expect(isIban('GB82 WEST 1234 5698 7654 33')).toBe(false);
    expect(isLuhn('4539 1488 0343 6467')).toBe(true);
    expect(isLuhn('4539 1488 0343 6468')).toBe(false);
  });
});

describe('client.screen options', () => {
  const screen = CLIENT_APP_COMPONENTS.find((c) => c.definition.type === 'client.screen')!;
  const validate = (config: Record<string, unknown>) => screen.validate!(config, {});
  const buttons = [{ key: 'continue', label: 'Continue' }];

  test('a valid screen with the new field types passes', () => {
    expect(validate({
      title: 'Pay', buttons,
      fields: [
        { key: 'code', label: 'Code', type: 'scan', parse: 'emv', required: true },
        { key: 'amount', label: 'Amount', type: 'money', visibleIf: '$not($exists(codeDetails.amount))' },
        { key: 'pin', label: 'Code', type: 'otp', length: 6 },
        { key: 'months', label: 'Months', type: 'slider', min: 6, max: 60, step: 6 },
        { key: 'monthly', label: 'Monthly', type: 'display', expression: 'amount / months', format: 'money' },
        { key: 'iban', label: 'IBAN', type: 'text', check: 'iban', pattern: '^[A-Z]{2}' },
      ],
      autoSubmit: { button: 'continue', when: 'expression', expression: 'codeDetails.valid', delay: 2 },
    })).toEqual([]);
  });

  test('mistakes are reported at publication', () => {
    const errors = validate({
      title: 'Pay', buttons,
      fields: [
        { key: 'total', label: 'Total', type: 'display' },
        { key: 'amount', label: 'Amount', type: 'money', visibleIf: 'codeDetails.(' },
        { key: 'ref', label: 'Reference', type: 'text', pattern: '([a-z' },
      ],
      autoSubmit: { button: 'pay', when: 'expression' },
    }).join('\n');
    expect(errors).toContain('total');
    expect(errors).toMatch(/amount.*(shown|visib)/i);
    expect(errors).toMatch(/ref.*pattern/i);
    expect(errors).toContain('"pay", which is not one of its buttons');
    expect(errors).toContain('the rule is empty');
  });
});
