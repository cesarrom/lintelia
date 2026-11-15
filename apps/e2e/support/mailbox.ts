import { env } from './env';

export interface Email {
  id: string;
  from?: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  sentAt: string;
  links: string[];
}

const extractLinks = (email: Omit<Email, 'links'>) =>
  [...new Set(`${email.text ?? ''} ${email.html ?? ''}`.match(/https?:\/\/[^\s"'<>]+/g) ?? [])].map((l) => l.replace(/&amp;/g, '&'));

const recipients = (to: string | string[]) => [to].flat().map((r) => r.toLowerCase());

interface MailboxMessage {
  id: string;
  receivedAt: string;
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string | null;
  tenant: string | null;
}

const toEmail = (m: MailboxMessage): Email => ({
  id: m.id, from: m.from, to: m.to, subject: m.subject, text: m.text, html: m.html ?? undefined, sentAt: m.receivedAt,
  links: extractLinks({ id: m.id, to: m.to, subject: m.subject, text: m.text, html: m.html ?? undefined, sentAt: m.receivedAt }),
});

/**
 * Every e-mail the platform sent to `to` (newest first), from the local mailbox (fake-services/mailbox, which receives
 * everything the API sends over SMTP). `tenant` null = platform e-mails (staff invitations).
 */
export async function emailsTo(opts: { tenant?: string | null; to: string; since?: number; subject?: string | RegExp }): Promise<Email[]> {
  const url = new URL('/api/messages', env.mailboxUrl);
  url.searchParams.set('to', opts.to);
  if (opts.since) url.searchParams.set('since', new Date(opts.since).toISOString());
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Mailbox ${env.mailboxUrl} answered ${response.status}; is the stack running (bun run stack)?`);
  const messages = (await response.json()) as MailboxMessage[];
  return messages
    .filter((m) => opts.tenant === undefined || (m.tenant ?? null) === (opts.tenant ?? null))
    .filter((m) => !opts.subject || (typeof opts.subject === 'string' ? m.subject.includes(opts.subject) : opts.subject.test(m.subject)))
    .map(toEmail);
}

/** Wait for the newest e-mail to `to` matching the filters. */
export async function waitForEmail(opts: { tenant?: string | null; to: string; subject?: string | RegExp; since?: number; timeoutMs?: number }): Promise<Email> {
  const deadline = Date.now() + (opts.timeoutMs ?? 10_000);
  while (Date.now() < deadline) {
    const [match] = await emailsTo(opts);
    if (match) return match;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`No e-mail to ${opts.to} (${opts.subject ?? 'any subject'}, tenant ${opts.tenant ?? 'any'}) in the mailbox within ${opts.timeoutMs ?? 10_000}ms`);
}

/** First link in the e-mail whose URL has the given query parameter; returns the URL and the parameter value. */
export function linkWithParam(email: Email, param: string) {
  for (const link of email.links) {
    const url = new URL(link);
    const value = url.searchParams.get(param);
    if (value) return { url, value };
  }
  throw new Error(`No link with ?${param}= in e-mail "${email.subject}": ${email.links.join(', ')}`);
}

/** A 6-digit one-time code in the e-mail body. */
export function otpCode(email: Email) {
  const match = `${email.text ?? ''} ${email.html ?? ''}`.match(/\b(\d{6})\b/);
  if (!match) throw new Error(`No 6-digit code in e-mail "${email.subject}"`);
  return match[1];
}
