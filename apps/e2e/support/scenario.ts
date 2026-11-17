import { expect } from '@playwright/test';
import { Api, expectStatus, type Session } from './api';
import { env } from './env';
import { addMember, createTenant, uniqueEmail, type TenantHandle } from './factories';
import { otpCode, waitForEmail } from './mailbox';
import { simpleFormConfig } from './workflows';
import { randomUUID } from 'node:crypto';
import { connect, coreBankingDatabase } from './connectors';

export type Member = Session & { email: string };

export interface Institution {
  bank: TenantHandle;
  members: Record<string, Member>;
  /** Connection ids by logical name (didit, documenso, coreBankingDb, screening, ai, loanpro, sheets, quickbooks). */
  connections: Record<string, string>;
}

export type ConnectionName = 'didit' | 'documenso' | 'coreBankingDb' | 'screening' | 'ai' | 'loanpro' | 'sheets' | 'quickbooks';


/** Connections made through connectors (docs/plans/03): the connector's own settings page, like an administrator. */
const CONNECTOR_CONNECTIONS: Partial<Record<ConnectionName, { connector: string; values: () => Record<string, string | number | boolean> }>> = {
  coreBankingDb: { connector: 'postgres-datasource', values: () => coreBankingDatabase() },
  // API keys are unique per institution: the fakes route webhooks by API key, like the vendors' consoles do per account.
  didit: { connector: 'didit', values: () => ({ apiKey: `didit-key-${randomUUID()}`, webhookSecret: 'didit-webhook-secret', workflowId: 'kyc-standard', baseUrl: env.fakes.didit }) },
  documenso: { connector: 'documenso', values: () => ({ apiKey: `documenso-key-${randomUUID()}`, webhookSecret: 'documenso-webhook-secret', baseUrl: `${env.fakes.documenso}/api/v2` }) },
  screening: { connector: 'screening', values: () => ({ apiKey: `screening-key-${randomUUID()}`, baseUrl: env.fakes.screening }) },
  ai: { connector: 'ai', values: () => ({ baseUrl: `${env.fakes.llm}/v1`, apiKey: `sk-e2e-${randomUUID()}`, model: 'fake-extractor-1' }) },
  // LoanPro routes webhooks per tenant (Autopal-Instance-Id): one instance per institution.
  loanpro: { connector: 'loanpro', values: () => ({ baseUrl: `${env.fakes.loanpro}/api/public/api/1`, instanceId: `e2e-${randomUUID().slice(0, 8)}`, apiToken: `lp-${randomUUID()}`, webhookSecret: 'loanpro-webhook-secret' }) },
  // Two "HTTP API" connections: the institution's Google Sheets and QuickBooks, no dedicated connector needed.
  sheets: { connector: 'http', values: () => ({ label: 'Deal log (Google Sheets)', baseUrl: env.fakes.sheets, authType: 'bearer', token: `ya29.e2e-${randomUUID()}` }) },
  quickbooks: { connector: 'http', values: () => ({ label: 'QuickBooks Online', baseUrl: env.fakes.quickbooks, authType: 'bearer', token: `qbo-e2e-${randomUUID()}` }) },
};

/** An institution with members in the given roles (one member per entry) and connections to local fakes. */
export async function prepareInstitution(opts: { members?: Record<string, string>; connections?: ConnectionName[] } = {}): Promise<Institution> {
  const bank = await createTenant();
  const members: Record<string, Member> = {};
  for (const [label, role] of Object.entries(opts.members ?? {})) {
    members[label] = await addMember(bank, { roles: [role], label });
  }
  const connections: Record<string, string> = {};
  for (const name of opts.connections ?? []) {
    const viaConnector = CONNECTOR_CONNECTIONS[name];
    if (viaConnector) {
      const { installationId, result } = await connect(bank.adminApi, viaConnector.connector, viaConnector.values());
      expect(result.error, `connecting ${viaConnector.connector}`).toBeNull();
      connections[name] = installationId;
      continue;
    }
    throw new Error(`No connector for connection ${name}`);
  }
  return { bank, members, connections };
}

/** Create a form, link it to a published workflow and publish it for the institution's own site (DES-01). */
export async function publishForm(api: Api, bank: TenantHandle, workflowId: string) {
  const form = await api.post('/forms', { name: `Application ${Date.now()}`, config: simpleFormConfig('application') });
  expectStatus(form, [200, 201]);
  const published = await api.post(`/forms/${form.body.id}/publish`, { workflowId, allowedOrigins: [bank.url('').replace(/\/$/, '')] });
  expectStatus(published, 200);
  return { formId: form.body.id as string, publicKey: published.body.publicKey as string };
}

/**
 * A prospective client applies through the published form and confirms their e-mail with the code they receive
 * (CLI-03 + CLI-02). Returns the case id and the client's session.
 */
export async function applyAsClient(bank: TenantHandle, publicKey: string, answers: Record<string, unknown> = {}) {
  const email = (answers.email as string) ?? uniqueEmail('applicant', 'customers.example');
  const origin = bank.url('').replace(/\/$/, '');
  const submitted = await Api.anonymous(bank.key).withHeaders({ Origin: origin })
    .post(`/public/forms/${publicKey}/submissions`, { email, answers: { fullName: 'Ada Applicant', email, ...answers } });
  expectStatus(submitted, 202);
  const code = otpCode(await waitForEmail({ tenant: bank.key, to: email, since: Date.now() - 5000 }));
  const verified = await Api.anonymous(bank.key).post<Session>('/auth/otp/verify', { email, code });
  expectStatus(verified, 200);
  return { caseId: submitted.body.caseId as string, client: { ...verified.body, email } };
}

/** Poll a case until `predicate` holds (durable executions advance asynchronously). */
export async function waitForCase(api: Api, caseId: string, predicate: (kase: any) => boolean, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let last: any;
  while (Date.now() < deadline) {
    const res = await api.get(`/cases/${caseId}`);
    expectStatus(res, 200);
    last = res.body;
    if (predicate(last)) return last;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Case ${caseId} did not reach the expected state in ${timeoutMs}ms; last: ${JSON.stringify(last)?.slice(0, 500)}`);
}

/** Wait until the member sees an open task for the case in one of their views, and return it. */
export async function waitForTask(api: Api, caseId: string, opts: { view?: 'mine' | 'queue' | 'all'; status?: string; timeoutMs?: number } = {}) {
  const deadline = Date.now() + (opts.timeoutMs ?? 20_000);
  while (Date.now() < deadline) {
    const res = await api.get(`/tasks?view=${opts.view ?? 'queue'}`);
    expectStatus(res, 200);
    const task = (res.body as any[]).find((t) => t.caseId === caseId && (!opts.status || t.status === opts.status));
    if (task) return task;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`No task for case ${caseId} in view ${opts.view ?? 'queue'}`);
}

export async function decide(api: Api, taskId: string, decision: 'approve' | 'reject' | 'request_info', reason = 'e2e decision', extra: Record<string, unknown> = {}) {
  return api.post(`/tasks/${taskId}/decision`, { decision, reason, ...extra });
}

export const expectCaseStatus = (kase: any, status: string) => expect(kase.status, JSON.stringify(kase).slice(0, 400)).toBe(status);

/** Sign a client in with an e-mailed code (CLI-02). */
export async function clientSignIn(bank: TenantHandle, email: string): Promise<Session> {
  const since = Date.now() - 1000;
  expectStatus(await Api.anonymous(bank.key).post('/auth/otp/start', { email }), 202);
  const code = otpCode(await waitForEmail({ tenant: bank.key, to: email, since }));
  const verified = await Api.anonymous(bank.key).post<Session>('/auth/otp/verify', { email, code });
  expectStatus(verified, 200);
  return verified.body;
}

/** The client confirms (with consent) an application an adviser started for them (RM-01), which starts the workflow. */
export async function confirmAssisted(bank: TenantHandle, email: string, caseId: string) {
  const client = await clientSignIn(bank, email);
  const confirmed = await Api.as(client).post(`/me/cases/${caseId}/confirm`, { consent: true });
  expectStatus(confirmed, 200);
  return client;
}
