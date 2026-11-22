import * as restate from '@restatedev/restate-sdk/fetch';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { parseConnectorComponentType } from '@repo/lintelia/schemas';
import { cases, connectorInstallations } from '../entities';
import type { Databases } from '../clients/database.client';
import { DATABASES } from '../injector/tokens/databases.token';
import type { ConnectorInvocation, ConnectorInvocationResult } from '../engine/components/types';
import { durationMs } from '../engine/durations';
import { sha256Base64Url, signAsCore } from '../auth/signing-keys';
import { ConnectorRegistry, connectorUrl } from './registry';

export const CALLBACK_AUDIENCE = 'connector-callback';

/** Claims of the callback token handed to a connector for async steps (it proves which step it completes). */
export interface CallbackClaims {
  tid: string;
  cid: string;
  pr: string;
  sid: string;
  con: string;
  /** installation id */
  sub: string;
}

/**
 * Calls connector actions on behalf of the case engine (docs/plans/03 §Core ⇄ connector protocol): a POST to the
 * component's invoke URL with a short-lived EdDSA JWT (audience = connector id, body hash claim) and an idempotency key.
 * 4xx answers are terminal for the step; network errors and 5xx are retried by Restate.
 */
@Injectable()
export class ConnectorInvoker {
  constructor(
    @Inject(DATABASES) private readonly databases: Databases,
    @Inject(ConnectorRegistry) private readonly registry: ConnectorRegistry,
  ) { }

  /** Signed headers for a core → connector request. */
  async requestHeaders(connectorId: string, installationId: string, body: string, idempotencyKey?: string) {
    const token = await signAsCore({ body_hash: sha256Base64Url(body) }, { audience: connectorId, subject: installationId, expiresIn: '60s' });
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    };
  }

  async invoke(input: ConnectorInvocation): Promise<ConnectorInvocationResult> {
    const parsed = parseConnectorComponentType(input.componentType);
    if (!parsed) throw new restate.TerminalError(`Not a connector component: ${input.componentType}`);
    const manifest = this.registry.manifest(parsed.connectorId);
    if (!manifest) throw new restate.TerminalError(`Connector ${parsed.connectorId} is not available`);
    const component = manifest.components.find((c) => c.key === parsed.key);
    if (!component) throw new restate.TerminalError(`Connector ${parsed.connectorId} has no component ${parsed.key}`);

    const installationId = String(input.config.connection ?? '');
    const db = this.databases.forTenant(input.tenantId);
    const [installation] = await db.select().from(connectorInstallations)
      .where(and(eq(connectorInstallations.id, installationId), eq(connectorInstallations.connectorId, manifest.id))).limit(1);
    if (!installation) throw new restate.TerminalError(`Connection ${installationId} of ${manifest.name} not found`);
    if (installation.status === 'disabled' || installation.status === 'pending') {
      throw new restate.TerminalError(`Connection "${installation.displayName}" is ${installation.status}`);
    }
    const [kase] = await db.select({ id: cases.id, reference: cases.reference }).from(cases).where(eq(cases.id, input.caseId)).limit(1);

    const lifetimeMs = (durationMs(component.invoke.timeout) ?? 7 * 24 * 3600_000) + 24 * 3600_000;
    const callbackToken = await signAsCore(
      { tid: input.tenantId, cid: input.caseId, pr: input.callbackPromise, sid: input.stepId, con: manifest.id },
      { audience: CALLBACK_AUDIENCE, subject: installation.id, expiresIn: `${Math.ceil(lifetimeMs / 1000)}s` },
    );
    const { connection: _connection, ...config } = input.config;
    const body = JSON.stringify({
      installationId: installation.id,
      component: component.key,
      config,
      input: input.input,
      case: kase ? { id: kase.id, reference: kase.reference } : { id: input.caseId },
      callback: { token: callbackToken },
      idempotencyKey: input.idempotencyKey,
    });

    let response: Response;
    try {
      response = await fetch(connectorUrl(manifest, component.invoke.url), {
        method: 'POST',
        headers: await this.requestHeaders(manifest.id, installation.id, body, input.idempotencyKey),
        body,
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      throw new Error(`Connector ${manifest.id} unreachable: ${(error as Error).message}`);
    }
    const text = await response.text();
    if (response.status >= 400 && response.status < 500) {
      throw new restate.TerminalError(`Connector ${manifest.id} refused the step (${response.status}): ${text.slice(0, 300)}`);
    }
    if (!response.ok) throw new Error(`Connector ${manifest.id} failed (${response.status}): ${text.slice(0, 300)}`);
    const result = JSON.parse(text || '{}');
    if (component.invoke.mode === 'sync' || result.outcome) {
      if (!component.events.includes(result.outcome)) {
        throw new restate.TerminalError(`Connector ${manifest.id} answered unknown outcome "${result.outcome}"`);
      }
      return { mode: 'sync', outcome: result.outcome, output: result.output ?? {} };
    }
    return { mode: 'async', ref: result.ref, clientAction: result.clientAction };
  }
}
