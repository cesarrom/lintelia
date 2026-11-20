import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { CoreApiError, createConnector, type Installation } from '@repo/connector-sdk';
import { manifest } from './manifest';

/**
 * Didit connector (docs/plans/05). Assumptions about Didit's API are listed in docs/ASSUMPTIONS.md; locally it talks to
 * fake-services/didit. The decision always comes from Didit's signed webhook (never from the browser).
 */
interface DiditSettings {
  baseUrl: string;
  workflowId: string;
}

const DEFAULT_BASE_URL = process.env.DIDIT_API_URL ?? (process.env.NODE_ENV === 'production' ? 'https://verification.didit.me' : 'http://localhost:9401');

async function didit(settings: DiditSettings, apiKey: string | null, path: string, init: RequestInit = {}) {
  const response = await fetch(new URL(path, settings.baseUrl), {
    ...init,
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey ?? '', ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Didit answered ${response.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : {};
}

/** Local development only: "paste the webhook URL in the Didit console" against the fake. */
async function registerFakeWebhook(settings: DiditSettings, apiKey: string, url: string, secret: string) {
  if (process.env.NODE_ENV === 'production' || !/^http:\/\/(localhost|127\.0\.0\.1)/.test(settings.baseUrl)) return;
  await fetch(new URL('/__control/webhooks', settings.baseUrl), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey, url, secret }) }).catch(() => undefined);
}

const webhookUrl = (publicUrl: string, installationId: string) => `${publicUrl}/webhooks/didit/${installationId}`;

const OUTCOMES: Record<string, 'approved' | 'declined' | 'in_review' | 'expired'> = {
  Approved: 'approved', Declined: 'declined', 'In Review': 'in_review', Abandoned: 'expired', Expired: 'expired',
};

const connector = createConnector({
  manifest,
  settings: {
    intro: "Use the API key and webhook secret from your Didit console. Identity documents and selfies stay at Didit; Lintelia keeps the decision.",
    fields: [
      { name: 'apiKey', label: 'API key', secret: true, required: true },
      { name: 'webhookSecret', label: 'Webhook secret', secret: true, required: true },
      { name: 'workflowId', label: 'Default Didit workflow id', required: true, default: 'kyc-standard' },
      { name: 'baseUrl', label: 'API base URL', type: 'url', required: true, default: DEFAULT_BASE_URL, help: 'https://verification.didit.me for production' },
    ],
    async test(values, secrets, context) {
      try {
        await didit(values as DiditSettings, secrets.apiKey, '/v2/workflows/');
      } catch (error) {
        throw new Error(`Didit refused the API key: ${(error as Error).message}`);
      }
      await registerFakeWebhook(values as DiditSettings, secrets.apiKey!, webhookUrl(context.publicUrl, context.installationId), secrets.webhookSecret!);
    },
    notes: (context) => [`Webhook URL to configure in the Didit console: ${webhookUrl(context.publicUrl, context.installationId)}`],
    summary: (values) => ({ workflow: values.workflowId, api: new URL(values.baseUrl).host }),
    displayName: (values) => `Didit · ${values.workflowId}`,
  },
});

connector.optionsFor('workflows', async (installation) => {
  const list = await didit(installation.config as unknown as DiditSettings, await installation.secrets.get('apiKey'), '/v2/workflows/') as Array<{ workflow_id: string; workflow_label: string }>;
  return list.map((w) => ({ value: w.workflow_id, label: w.workflow_label }));
});

connector.action('kyc.verify', async ({ installation, config, input, callback, case: kase, log }) => {
  const settings = installation.config as unknown as DiditSettings;
  const email = typeof input.email === 'string' && input.email.includes('@') ? input.email : undefined;
  const reference = randomUUID();
  const session = await didit(settings, await installation.secrets.get('apiKey'), '/v2/session/', {
    method: 'POST',
    // vendor_data is an opaque reference: no case ids or names leave Lintelia unless the Didit workflow needs them.
    body: JSON.stringify({ workflow_id: config.workflowId || settings.workflowId, vendor_data: reference, ...(email ? { contact_details: { email } } : {}) }),
  }) as { session_id: string; url: string };
  await installation.store.put(`session:${session.session_id}`, { callbackToken: callback.token, caseId: kase.id, reference });
  await installation.core.records.upsert({
    type: 'verification', externalRef: session.session_id, status: 'pending', callbackToken: callback.token,
    summary: 'Identity verification started', data: { kind: 'identity', provider: 'didit', sessionId: session.session_id },
  });
  log.info('didit session created', { installation: installation.id, case: kase.id, session: session.session_id });
  return {
    pending: true, ref: session.session_id,
    clientAction: { type: 'sdk', sdk: 'didit-web', url: session.url, title: 'Verify your identity', instructions: 'Have your ID document ready; you will take a photo of it and a short selfie video.' },
  };
});

const validSignature = (secret: string, body: string, signature: string | undefined) => {
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(body).digest();
  const given = Buffer.from(signature, 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
};

async function handleDecision(installation: Installation, sessionId: string, status: string) {
  const stored = await installation.store.get<{ callbackToken: string; caseId: string }>(`session:${sessionId}`);
  if (!stored) return 'unknown session';
  const outcome = OUTCOMES[status];
  if (!outcome) {
    await installation.core.records.upsert({ type: 'verification', externalRef: sessionId, status: 'in_progress', callbackToken: stored.callbackToken, summary: `Identity verification: ${status}` });
    return 'progress';
  }
  const decision = await didit(installation.config as unknown as DiditSettings, await installation.secrets.get('apiKey'), `/v2/session/${sessionId}/decision/`);
  const record = await installation.core.records.upsert({
    type: 'verification', externalRef: sessionId, status: outcome, callbackToken: stored.callbackToken,
    summary: `Identity verification: ${status}`,
    data: {
      kind: 'identity', provider: 'didit', sessionId,
      checks: { document: decision.id_verification?.status ?? null, liveness: decision.liveness?.status ?? null, faceMatch: decision.face_match?.status ?? null, aml: decision.aml?.status ?? null },
      person: decision.id_verification ? { firstName: decision.id_verification.first_name, lastName: decision.id_verification.last_name, dateOfBirth: decision.id_verification.date_of_birth, documentType: decision.id_verification.document_type, issuingState: decision.id_verification.issuing_state } : null,
      warnings: (decision.id_verification?.warnings ?? []).map((w: { short_description?: string; risk?: string }) => w.short_description ?? w.risk),
    },
  });
  try {
    await installation.core.executions.complete(stored.callbackToken, outcome, { verificationId: record.id, status: outcome });
  } catch (error) {
    // The step already ended (e.g. "in review" first, approved later): the record is updated, workflows can react to
    // the event.
    if (!(error instanceof CoreApiError && error.status === 409)) throw error;
    await installation.core.events.publish({ id: `${sessionId}:${status}`, type: 'verification.updated', subject: sessionId, data: { status: outcome, verificationId: record.id } }).catch(() => undefined);
  }
  return outcome;
}

connector.app.post('/webhooks/didit/:installationId', async (c) => {
  const installation = await connector.installation(c.req.param('installationId'));
  if (!installation) return c.json({ error: 'unknown installation' }, 404);
  const body = await c.req.text();
  const secret = await installation.secrets.get('webhookSecret');
  const timestamp = Number(c.req.header('x-timestamp'));
  if (!secret || !validSignature(secret, body, c.req.header('x-signature')) || !Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) {
    connector.log.error('rejected didit webhook (signature)', { installation: installation.id });
    return c.json({ error: 'invalid signature' }, 401);
  }
  const event = JSON.parse(body) as { session_id: string; status: string };
  // Deduplicate: Didit retries and may send the same status twice.
  const seen = `webhook:${event.session_id}:${event.status}`;
  if (await installation.store.get(seen)) return c.json({ duplicate: true });
  await installation.store.put(seen, { at: new Date().toISOString() });
  try {
    const result = await handleDecision(installation, event.session_id, event.status);
    return c.json({ received: true, result });
  } catch (error) {
    await installation.store.delete(seen);
    connector.log.error('didit webhook processing failed', { installation: installation.id, error: (error as Error).message });
    return c.json({ error: 'processing failed' }, 500);
  }
});

await connector.listen();
