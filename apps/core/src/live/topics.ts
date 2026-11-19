import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../constants';

/**
 * Live topics (docs/plans/17 §4.3). "Change" topics say that something changed (the screen fetches it again through
 * the normal, authorised endpoint); "message" topics carry what a workflow published on purpose, in order, kept a few
 * days so a screen that starts listening late gets them.
 *
 *   client/{id}/records/{collection} · client/{id}/records/*   a client's records
 *   client/{id}/notifications · client/{id}/profile · client/{id}/cases
 *   client/{id}/messages                                       messages of workflows to the client
 *   case/{id}                                                   the case (status, stage, tasks, screens)
 *   case/{id}/channel/{name} · case/{id}/channel/*              what its workflow publishes (`live.publish`)
 *   member/{id} · member/{id}/messages                         a member's tasks; messages to the member
 *   queue/{role} · queue/{role}/messages                       a role's queue; messages to the role
 *   cases                                                       any case of the institution changed (lists, boards)
 */
const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const NAME = '[a-z][a-z0-9_-]{0,63}';

export type ParsedTopic =
  | { kind: 'client'; id: string; part: 'records' | 'notifications' | 'profile' | 'cases' | 'messages'; collection?: string }
  | { kind: 'case'; id: string; channel?: string }
  | { kind: 'member'; id: string; messages: boolean }
  | { kind: 'queue'; role: string; messages: boolean }
  | { kind: 'cases' };

const PATTERNS: Array<[RegExp, (m: RegExpMatchArray) => ParsedTopic]> = [
  [new RegExp(`^client/(${UUID})/records/(${NAME}|\\*)$`), (m) => ({ kind: 'client', id: m[1].toLowerCase(), part: 'records', collection: m[2] })],
  [new RegExp(`^client/(${UUID})/(notifications|profile|cases|messages)$`), (m) => ({ kind: 'client', id: m[1].toLowerCase(), part: m[2] as 'notifications' })],
  [new RegExp(`^case/(${UUID})$`), (m) => ({ kind: 'case', id: m[1].toLowerCase() })],
  [new RegExp(`^case/(${UUID})/channel/(${NAME}|\\*)$`), (m) => ({ kind: 'case', id: m[1].toLowerCase(), channel: m[2] })],
  [new RegExp(`^member/(${UUID})$`), (m) => ({ kind: 'member', id: m[1].toLowerCase(), messages: false })],
  [new RegExp(`^member/(${UUID})/messages$`), (m) => ({ kind: 'member', id: m[1].toLowerCase(), messages: true })],
  [new RegExp(`^queue/(${NAME})$`), (m) => ({ kind: 'queue', role: m[1], messages: false })],
  [new RegExp(`^queue/(${NAME})/messages$`), (m) => ({ kind: 'queue', role: m[1], messages: true })],
  [/^cases$/, () => ({ kind: 'cases' })],
];

export function parseTopic(topic: string): ParsedTopic | null {
  for (const [pattern, build] of PATTERNS) {
    const match = topic.match(pattern);
    if (match) return build(match);
  }
  return null;
}

/** Topics whose messages are kept and replayed (the rest only say "changed"). */
export const isMessageTopic = (topic: string) => /\/channel\/|\/messages$/.test(topic);

/** Does a subscription (possibly ending in `/*`) cover this topic? */
export const covers = (subscription: string, topic: string) =>
  subscription === topic || (subscription.endsWith('/*') && topic.startsWith(subscription.slice(0, -1)) && !topic.slice(subscription.length - 1).includes('/'));

// --- capability URLs (`case.live.<channel>`) ---------------------------------------------------------------------------

const sign = (tenantId: string, caseId: string, channel: string, expires: number) =>
  createHmac('sha256', env.AUTH_JWT_SECRET).update(`case-live:${tenantId}:${caseId}:${channel}:${expires}`).digest('base64url').slice(0, 43);

/** A read-only address to listen to one channel of one case until `expires` (seconds), for screens we do not serve. */
export function channelUrl(tenantId: string, caseId: string, channel: string, expires: number) {
  const query = new URLSearchParams({ tenant: tenantId, expires: String(expires), token: sign(tenantId, caseId, channel, expires) });
  return `${env.HOST.replace(/\/$/, '')}/live/cases/${caseId}/channels/${channel}?${query}`;
}

export function verifyChannelToken(token: string | null | undefined, tenantId: string, caseId: string, channel: string, expires: number) {
  if (!token || !Number.isFinite(expires) || expires * 1000 < Date.now()) return false;
  const expected = Buffer.from(sign(tenantId, caseId, channel, expires));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Capability URLs of a case live 30 days from its creation (deterministic for the engine's replays). */
export const channelExpiry = (createdAt: Date | string) => Math.floor(new Date(createdAt).getTime() / 1000) + 30 * 86_400;

/** What a start response tells the caller to listen to (docs/plans/17 §4.6): the case, and what its workflow publishes. */
export const caseLive = (caseId: string) => ({
  topics: [`case/${caseId}`, `case/${caseId}/channel/*`],
  url: `${env.HOST.replace(/\/$/, '')}/live?topics=${encodeURIComponent(`case/${caseId}`)},${encodeURIComponent(`case/${caseId}/channel/*`)}&since=0`,
});
