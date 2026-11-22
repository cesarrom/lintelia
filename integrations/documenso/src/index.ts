import { randomUUID, timingSafeEqual } from 'node:crypto';
import { createConnector, type Installation } from '@repo/connector-sdk';
import { manifest } from './manifest';

/**
 * Documenso connector (docs/plans/05), on the v2 API (docs/vendor-api/documenso-openapi-v2.json). Webhook details are
 * assumptions (docs/ASSUMPTIONS.md); locally it talks to fake-services/documenso.
 */
interface Settings {
  baseUrl: string;
}

const DEFAULT_BASE_URL = process.env.DOCUMENSO_API_URL ?? (process.env.NODE_ENV === 'production' ? 'https://app.documenso.com/api/v2' : 'http://localhost:9402/api/v2');

async function documenso(settings: Settings, apiKey: string | null, path: string, init: RequestInit = {}) {
  const response = await fetch(`${settings.baseUrl.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: apiKey ?? '', ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Documenso answered ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return response;
}

const json = async (settings: Settings, apiKey: string | null, path: string, init?: RequestInit) => (await documenso(settings, apiKey, path, init)).json();

/** Where signers sign: the app's `/sign/<recipient token>` page, next to the API. */
const signingUrl = (settings: Settings, token: string) => `${new URL(settings.baseUrl).origin}/sign/${token}`;
const webhookUrl = (publicUrl: string, installationId: string) => `${publicUrl}/webhooks/documenso/${installationId}`;

async function registerFakeWebhook(settings: Settings, apiKey: string, url: string, secret: string) {
  if (process.env.NODE_ENV === 'production' || !/^http:\/\/(localhost|127\.0\.0\.1)/.test(settings.baseUrl)) return;
  await fetch(new URL('/__control/webhooks', settings.baseUrl), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey, url, secret }) }).catch(() => undefined);
}

const connector = createConnector({
  manifest,
  settings: {
    intro: 'Use an API token of your Documenso team. Templates are managed in Documenso; workflow steps reference them.',
    fields: [
      { name: 'apiKey', label: 'API token', secret: true, required: true },
      { name: 'webhookSecret', label: 'Webhook secret', secret: true, required: true, help: 'the secret you set on the webhook in Documenso' },
      { name: 'baseUrl', label: 'API base URL', type: 'url', required: true, default: DEFAULT_BASE_URL, help: 'https://app.documenso.com/api/v2, or your self-hosted instance' },
    ],
    async test(values, secrets, context) {
      try {
        await json(values as Settings, secrets.apiKey, '/template');
      } catch (error) {
        throw new Error(`Documenso refused the token: ${(error as Error).message}`);
      }
      await registerFakeWebhook(values as Settings, secrets.apiKey!, webhookUrl(context.publicUrl, context.installationId), secrets.webhookSecret!);
    },
    notes: (context) => [`Webhook URL to add in Documenso (events: document signed, completed, rejected): ${webhookUrl(context.publicUrl, context.installationId)}`],
    summary: (values) => ({ api: new URL(values.baseUrl).host }),
    displayName: (values) => `Documenso · ${new URL(values.baseUrl).host}`,
  },
});

connector.optionsFor('templates', async (installation) => {
  const list = await json(installation.config as unknown as Settings, await installation.secrets.get('apiKey'), '/template') as { data: Array<{ id: number; title: string }> };
  return list.data.map((t) => ({ value: String(t.id), label: t.title }));
});

/** Templates can be referenced by id or by their external id (e.g. `retail-account-agreement`). */
async function resolveTemplate(settings: Settings, apiKey: string | null, reference: string) {
  if (/^\d+$/.test(reference)) return json(settings, apiKey, `/template/${reference}`);
  const list = await json(settings, apiKey, '/template') as { data: Array<{ id: number; externalId: string | null }> };
  const match = list.data.find((t) => t.externalId === reference);
  if (!match) throw new Error(`Unknown Documenso template "${reference}"`);
  return json(settings, apiKey, `/template/${match.id}`);
}

connector.action('signature.request', async ({ installation, config, input, callback, case: kase, log }) => {
  const settings = installation.config as unknown as Settings;
  const apiKey = await installation.secrets.get('apiKey');
  const email = String(input.signerEmail ?? '').trim();
  if (!email.includes('@')) throw new Error('The signer needs an e-mail address');
  const template = await resolveTemplate(settings, apiKey, String(config.templateId)) as { id: number; recipients: Array<{ id: number; role: string }> };
  const signer = template.recipients.find((r) => r.role === 'SIGNER') ?? template.recipients[0];
  const reference = randomUUID();
  const document = await json(settings, apiKey, '/template/use', {
    method: 'POST',
    body: JSON.stringify({ templateId: template.id, externalId: reference, recipients: [{ id: signer.id, email, name: String(input.signerName || email) }], distributeDocument: true }),
  }) as { id: number; recipients: Array<{ email: string; token: string }> };
  const recipient = document.recipients.find((r) => r.email.toLowerCase() === email.toLowerCase()) ?? document.recipients[0];
  await installation.store.put(`document:${document.id}`, { callbackToken: callback.token, caseId: kase.id, kind: config.documentKind || 'signed_agreement' });
  await installation.core.records.upsert({
    type: 'signature_request', externalRef: String(document.id), status: 'pending', callbackToken: callback.token,
    summary: 'Signature requested', data: { provider: 'documenso', documentId: document.id, signers: [{ email, status: 'pending' }] },
  });
  log.info('documenso document created', { installation: installation.id, case: kase.id, document: document.id });
  return {
    pending: true, ref: String(document.id),
    clientAction: { type: 'embed', url: signingUrl(settings, recipient.token), title: String(config.title || 'Sign your agreement'), instructions: String(config.instructions || 'Read the agreement and sign it electronically.') },
  };
});

async function onEvent(installation: Installation, event: string, payload: { id: number; status: string; recipients?: Array<{ email: string; signingStatus: string; signedAt?: string | null }> }) {
  const stored = await installation.store.get<{ callbackToken: string; caseId: string; kind: string }>(`document:${payload.id}`);
  if (!stored) return 'unknown document';
  const signers = (payload.recipients ?? []).map((r) => ({ email: r.email, status: r.signingStatus.toLowerCase(), signedAt: r.signedAt ?? null }));
  const settings = installation.config as unknown as Settings;
  if (event === 'DOCUMENT_COMPLETED') {
    const pdf = Buffer.from(await (await documenso(settings, await installation.secrets.get('apiKey'), `/document/${payload.id}/download?version=signed`)).arrayBuffer());
    await installation.core.files.upload({ callbackToken: stored.callbackToken, name: `signed-${payload.id}.pdf`, contentType: 'application/pdf', content: pdf, kind: stored.kind });
    const record = await installation.core.records.upsert({ type: 'signature_request', externalRef: String(payload.id), status: 'signed', callbackToken: stored.callbackToken, summary: 'Document signed', data: { provider: 'documenso', documentId: payload.id, signers } });
    await installation.core.executions.complete(stored.callbackToken, 'signed', { signatureRequestId: record.id, documentId: payload.id });
    return 'signed';
  }
  if (event === 'DOCUMENT_REJECTED') {
    const record = await installation.core.records.upsert({ type: 'signature_request', externalRef: String(payload.id), status: 'declined', callbackToken: stored.callbackToken, summary: 'Signature declined', data: { provider: 'documenso', documentId: payload.id, signers } });
    await installation.core.executions.complete(stored.callbackToken, 'declined', { signatureRequestId: record.id, documentId: payload.id });
    return 'declined';
  }
  await installation.core.records.upsert({ type: 'signature_request', externalRef: String(payload.id), status: 'in_progress', callbackToken: stored.callbackToken, summary: 'Signing in progress', data: { provider: 'documenso', documentId: payload.id, signers } });
  return 'progress';
}

connector.app.post('/webhooks/documenso/:installationId', async (c) => {
  const installation = await connector.installation(c.req.param('installationId'));
  if (!installation) return c.json({ error: 'unknown installation' }, 404);
  const secret = await installation.secrets.get('webhookSecret');
  const given = Buffer.from(c.req.header('x-documenso-secret') ?? '');
  if (!secret || given.length !== Buffer.byteLength(secret) || !timingSafeEqual(given, Buffer.from(secret))) return c.json({ error: 'invalid secret' }, 401);
  const { event, payload } = await c.req.json<{ event: string; payload: { id: number; status: string } }>();
  const seen = `webhook:${payload.id}:${event}`;
  if (await installation.store.get(seen)) return c.json({ duplicate: true });
  await installation.store.put(seen, { at: new Date().toISOString() });
  try {
    return c.json({ received: true, result: await onEvent(installation, event, payload) });
  } catch (error) {
    await installation.store.delete(seen);
    connector.log.error('documenso webhook processing failed', { installation: installation.id, error: (error as Error).message });
    return c.json({ error: 'processing failed' }, 500);
  }
});

await connector.listen();
