import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { env, NotConfiguredError } from '../constants';

export interface EmailMessage {
  from?: string;
  to: string | string[];
  cc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  /** Tenant that sends the message (for outbox grouping and auditing). */
  tenant?: string;
}

/** Outgoing e-mail. Tenants will later connect their own mail servers; this is the platform default transport. */
export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<{ id: string }>;
}

/** Writes messages as JSON files to EMAIL_OUTBOX_DIR (local development and tests). Nothing leaves the machine. */
export class OutboxEmailProvider implements EmailProvider {
  readonly name = 'outbox';
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = resolve(dir);
  }

  async send(message: EmailMessage) {
    const id = randomUUID();
    const folder = join(this.dir, message.tenant ?? '_platform');
    await mkdir(folder, { recursive: true });
    const file = join(folder, `${new Date().toISOString().replaceAll(':', '-')}_${id}.json`);
    await writeFile(file, JSON.stringify({ id, from: message.from ?? env.EMAIL_FROM, ...message, sentAt: new Date().toISOString() }, null, 2));
    console.log(`\x1b[35m[outbox]\x1b[0m "${message.subject}" -> ${[message.to].flat().join(', ')} (${file})`);
    return { id };
  }
}

export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp';
  private readonly transport: nodemailer.Transporter;

  constructor() {
    if (!env.SMTP_HOST || !env.SMTP_PORT) {
      throw new NotConfiguredError('SMTP e-mail', ['SMTP_HOST', 'SMTP_PORT']);
    }
    this.transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }

  async send(message: EmailMessage) {
    const info = await this.transport.sendMail({
      from: message.from ?? env.EMAIL_FROM,
      to: message.to,
      cc: message.cc,
      subject: message.subject,
      text: message.text,
      html: message.html,
      // Lets the local mailbox (fake-services/mailbox) and mail logs group messages by institution.
      headers: message.tenant ? { 'X-Fintivio-Tenant': message.tenant } : undefined,
    });
    console.log(`\x1b[35m[smtp]\x1b[0m "${message.subject}" -> ${[message.to].flat().join(', ')}`);
    return { id: info.messageId };
  }
}

export const EMAIL_PROVIDER = Symbol.for('EMAIL_PROVIDER');
export const EMAIL_PROVIDER_FACTORY = {
  provide: EMAIL_PROVIDER,
  useFactory: (): EmailProvider => (env.EMAIL_PROVIDER === 'smtp' ? new SmtpEmailProvider() : new OutboxEmailProvider(env.EMAIL_OUTBOX_DIR)),
};
