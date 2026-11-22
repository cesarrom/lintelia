import { describe, expect, test } from 'bun:test';
import { channelUrl, covers, isMessageTopic, parseTopic, verifyChannelToken } from '../src/live/topics';
import { computeKeys, eventScope, keyValue, waitMatches } from '../src/engine/events';
import { parseDefinition } from '../src/engine/definition';
import { validateDefinition } from '../src/engine/components/validation';

/** Live data and events (docs/plans/17) — no database. */
const CASE = '8b0c7d4e-1f2a-4b3c-9d8e-7f6a5b4c3d2e';

describe('live topics', () => {
  test('the grammar: clients, cases and their channels, members, queues', () => {
    expect(parseTopic(`client/${CASE}/records/accounts`)).toEqual({ kind: 'client', id: CASE, part: 'records', collection: 'accounts' });
    expect(parseTopic(`client/${CASE}/records/*`)).toMatchObject({ part: 'records', collection: '*' });
    expect(parseTopic(`case/${CASE}/channel/progress`)).toEqual({ kind: 'case', id: CASE, channel: 'progress' });
    expect(parseTopic('queue/senior_reviewer/messages')).toEqual({ kind: 'queue', role: 'senior_reviewer', messages: true });
    expect(parseTopic('cases')).toEqual({ kind: 'cases' });
    for (const bad of ['client/x/records/a', `case/${CASE}/channel/UPPER`, 'queue/', 'tenant/anything', `client/${CASE}/secrets`]) expect(parseTopic(bad)).toBeNull();
  });

  test('wildcards cover one level; message topics are the channels and messages', () => {
    expect(covers(`client/${CASE}/records/*`, `client/${CASE}/records/accounts`)).toBe(true);
    expect(covers(`client/${CASE}/records/*`, `client/${CASE}/notifications`)).toBe(false);
    expect(covers(`case/${CASE}/channel/*`, `case/${CASE}/channel/progress`)).toBe(true);
    expect(covers(`case/${CASE}`, `case/${CASE}/channel/progress`)).toBe(false);
    expect(isMessageTopic(`case/${CASE}/channel/progress`)).toBe(true);
    expect(isMessageTopic(`member/${CASE}/messages`)).toBe(true);
    expect(isMessageTopic(`case/${CASE}`)).toBe(false);
  });

  test('capability addresses: one case, one channel, until they expire', () => {
    const expires = Math.floor(Date.now() / 1000) + 60;
    const url = new URL(channelUrl('t1', CASE, 'progress', expires));
    const token = url.searchParams.get('token');
    expect(verifyChannelToken(token, 't1', CASE, 'progress', expires)).toBe(true);
    expect(verifyChannelToken(token, 't1', CASE, 'other', expires)).toBe(false);
    expect(verifyChannelToken(token, 't2', CASE, 'progress', expires)).toBe(false);
    expect(verifyChannelToken(token, 't1', CASE, 'progress', expires + 1)).toBe(false);
    const past = Math.floor(Date.now() / 1000) - 1;
    expect(verifyChannelToken(new URL(channelUrl('t1', CASE, 'progress', past)).searchParams.get('token'), 't1', CASE, 'progress', past)).toBe(false);
  });
});

describe('events about a case', () => {
  const event = { id: 'e1', type: 'api:loan.payment', source: 'api:core', data: { loanId: 'L-42', amount: 120 } };

  test('a wait matches the value of the case\'s key and its filter; broken expressions never match', async () => {
    expect(await waitMatches({ match: { loan: { expression: '= data.loanId', value: 'L-42' } }, filter: 'data.amount > 0' }, event)).toBe(true);
    expect(await waitMatches({ match: { loan: { expression: '= loanId', value: 'L-42' } }, filter: null }, event)).toBe(true);
    expect(await waitMatches({ match: { loan: { expression: '= data.loanId', value: 'L-43' } }, filter: null }, event)).toBe(false);
    expect(await waitMatches({ match: {}, filter: 'data.amount > 500' }, event)).toBe(false);
    expect(await waitMatches({ match: { loan: { expression: '= (((', value: 'L-42' } }, filter: null }, event)).toBe(false);
    expect(eventScope(event)).toMatchObject({ loanId: 'L-42', data: { amount: 120 }, type: 'api:loan.payment' });
  });

  test('keys are computed from the case; objects and empty values are no keys', async () => {
    expect(await computeKeys({ loan: '= input.loanId', client: '{{case.applicant.id}}', none: '= input.missing' }, { input: { loanId: 42 }, case: { applicant: { id: 'c1' } } }))
      .toEqual({ loan: 42, client: 'c1', none: undefined });
    expect([keyValue(42), keyValue('x'), keyValue(''), keyValue({ a: 1 }), keyValue(null)]).toEqual(['42', 'x', null, null, null]);
  });

  test('startOn takes event types or start-or-deliver rules; keys must be declared', () => {
    const yaml = `name: Loan
startOn:
  - api:loan.opened
  - { event: "api:loan.payment", correlate: { loan: "= data.loanId" } }
correlation: { loan: "= input.loanId" }
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, next: [wait] }] }
  - { id: wait, name: Wait, type: event.wait, config: { event: api:loan.payment, match: { loan: "= data.loanId", card: "= data.card" } }, events: [{ name: received, next: [] }] }
`;
    const definition = parseDefinition(yaml);
    expect(definition.startOn).toEqual(['api:loan.opened', 'api:loan.payment']);
    expect(definition.startRules[1]).toEqual({ event: 'api:loan.payment', correlate: { loan: '= data.loanId' } });
    expect(definition.correlation).toEqual({ loan: '= input.loanId' });
    expect(validateDefinition(definition).join(' ')).toContain('matches on the key "card"');
  });
});
