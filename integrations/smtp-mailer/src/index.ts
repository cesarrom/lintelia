import nodemailer from 'nodemailer';
import { createConnector } from '@repo/connector-sdk';
import { manifest } from './manifest';

/**
 * smtp-mailer (docs/plans/03 §First connectors): the institution's own SMTP server as a workflow step. Settings live in
 * this connector (password encrypted in its SecretStore); every e-mail becomes a `message` record on the case.
 */
interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromAddress: string;
  fromName: string;
}

const transport = (settings: SmtpSettings, password: string | null) => nodemailer.createTransport({
  host: settings.host,
  port: Number(settings.port),
  secure: settings.secure,
  auth: settings.username ? { user: settings.username, pass: password ?? '' } : undefined,
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
});

const connector = createConnector({
  manifest,
  settings: {
    intro: 'Workflow e-mails will be sent from this server and address. We check the connection before saving.',
    fields: [
      { name: 'host', label: 'SMTP host', required: true, placeholder: 'smtp.yourbank.com' },
      { name: 'port', label: 'Port', type: 'number', required: true, default: 587 },
      { name: 'secure', label: 'Use TLS from the start (port 465)', type: 'checkbox' },
      { name: 'username', label: 'Username', help: 'leave empty if the server does not need authentication' },
      { name: 'password', label: 'Password', secret: true },
      { name: 'fromAddress', label: 'From address', type: 'email', required: true, placeholder: 'no-reply@yourbank.com' },
      { name: 'fromName', label: 'From name', placeholder: 'Your Bank' },
    ],
    async test(values, secrets) {
      try {
        await transport(values as SmtpSettings, secrets.password).verify();
      } catch (error) {
        throw new Error(`Could not connect to ${values.host}:${values.port}: ${(error as Error).message}`);
      }
    },
    summary: (values) => ({ host: `${values.host}:${values.port}`, from: values.fromName ? `${values.fromName} <${values.fromAddress}>` : values.fromAddress }),
    displayName: (values) => `SMTP · ${values.fromAddress}`,
  },
});

connector.action('email.send', async ({ installation, config, input, callback, case: kase, log }) => {
  const settings = installation.config as unknown as SmtpSettings;
  const to = String(input.to ?? '').trim();
  const subject = String(config.subject ?? '').trim();
  if (!to || !/^[^\s@]+@[^\s@]+$/.test(to)) return { outcome: 'failed', output: { error: `Invalid recipient "${to}"` } };
  const password = await installation.secrets.get('password');
  try {
    const info = await transport(settings, password).sendMail({
      from: settings.fromName ? { name: settings.fromName, address: settings.fromAddress } : settings.fromAddress,
      to,
      subject,
      text: String(config.body ?? ''),
      replyTo: config.replyTo || undefined,
      headers: { 'X-Fintivio-Case': String(kase.reference ?? kase.id ?? '') },
    });
    const record = await installation.core.records.upsert({
      type: 'message', externalRef: info.messageId, status: 'sent', callbackToken: callback.token,
      summary: `E-mail to ${to}: ${subject}`,
      data: { channel: 'email', to, subject, from: settings.fromAddress, messageId: info.messageId },
    });
    log.info('e-mail sent', { installation: installation.id, case: kase.id, messageId: info.messageId });
    return { outcome: 'sent', output: { messageId: info.messageId, recordId: record.id, to } };
  } catch (error) {
    const message = (error as Error).message;
    log.error('e-mail failed', { installation: installation.id, case: kase.id, error: message });
    await installation.core.records.upsert({
      type: 'message', externalRef: `failed:${kase.id}:${Date.now()}`, status: 'failed', callbackToken: callback.token,
      summary: `E-mail to ${to} failed: ${message}`, data: { channel: 'email', to, subject, error: message },
    }).catch(() => undefined);
    return { outcome: 'failed', output: { error: message, to } };
  }
});

await connector.listen();
