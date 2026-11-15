import { env } from '../constants';
import { INTERNAL_SIGNATURE_HEADER, internalSignature } from '../auth/internal-signature';
import type { TaskSignal } from './case-runner';

/**
 * The API's handle on the case engine (Restate workflow `caseRun`), through the Restate ingress. Calls are signed
 * with a key derived from the server secret, bound to the tenant and case.
 */
export class EngineClient {
  private async call(path: string, body: Record<string, unknown>, tenantId: string, caseId: string) {
    const response = await fetch(new URL(path, env.RESTATE_ENDPOINT), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [INTERNAL_SIGNATURE_HEADER]: internalSignature(tenantId, caseId) },
      body: JSON.stringify({ tenantId, caseId, ...body }),
    });
    if (!response.ok) throw new Error(`Case engine call ${path} failed: ${response.status} ${await response.text()}`);
    return response.json().catch(() => ({}));
  }

  /** Start the durable execution of a case (asynchronously). */
  start(tenantId: string, caseId: string) {
    return this.call(`/caseRun/${caseId}/run/send`, {}, tenantId, caseId);
  }

  /** Deliver a decision / client answer to the waiting step. */
  signal(tenantId: string, caseId: string, taskId: string, signal: TaskSignal) {
    return this.call(`/caseRun/${caseId}/signal`, { taskId, signal }, tenantId, caseId);
  }

  /**
   * Stop the durable executions of these cases for good (an institution being deleted): they are killed through the
   * Restate admin API so they do not keep retrying against rows that no longer exist.
   */
  async killCases(caseIds: string[]) {
    const killed: string[] = [];
    for (let i = 0; i < caseIds.length; i += 200) {
      const keys = caseIds.slice(i, i + 200).filter((id) => /^[0-9a-f-]{36}$/i.test(id)).map((id) => `'${id}'`).join(',');
      if (!keys) continue;
      const response = await fetch(new URL('/query', env.RESTATE_ADMIN_ENDPOINT), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: `SELECT id FROM sys_invocation WHERE target_service_name = 'caseRun' AND status != 'completed' AND target_service_key IN (${keys})` }),
      });
      if (!response.ok) throw new Error(`Restate admin query failed: ${response.status} ${await response.text()}`);
      const { rows } = (await response.json()) as { rows: Array<{ id: string }> };
      for (const { id } of rows) {
        const kill = await fetch(new URL(`/invocations/${id}/kill`, env.RESTATE_ADMIN_ENDPOINT), { method: 'PATCH' });
        if (kill.ok || kill.status === 404) killed.push(id);
      }
    }
    return killed;
  }

  /** Resolve a named durable promise of the case (connector callbacks, child cases). */
  resolve(tenantId: string, caseId: string, promise: string, signal: TaskSignal) {
    return this.call(`/caseRun/${caseId}/resolve`, { promise, signal }, tenantId, caseId);
  }
}

export const ENGINE_CLIENT = Symbol.for('ENGINE_CLIENT');
export const CASE_REPOSITORY = Symbol.for('CASE_REPOSITORY');
