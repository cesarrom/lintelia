import type * as restate from '@restatedev/restate-sdk/fetch';
import type { ComponentDefinition } from '@repo/fintivio/schemas';
import type { Tenant } from '@repo/fintivio/schemas';
import type { CaseRepository } from '../case-repository';
import type { StepDefinition } from '../definition';
import type { Notifier } from '../notifier';
import type { AuditWriter } from '../../services/audit.writer';

/** What the API sends when a human step is decided, a client request is answered or a connector completes. */
export interface TaskSignal {
  outcome: string;
  reason?: string;
  by?: { id?: string; email?: string; type?: string };
  response?: Record<string, unknown>;
  output?: Record<string, unknown>;
  decisions?: Array<{ outcome: string; by: string; reason?: string; at: string }>;
}

export interface StepResult {
  /** Event to follow (`null` ends the branch). */
  event: string | null;
  /** Stored as `steps.<id>` and in `cases.results`. */
  output: unknown;
}

export interface EngineDeps {
  repository: CaseRepository;
  audit: AuditWriter;
  notifier: Notifier;
  loadTenant(tenantId: string): Promise<Tenant>;
  /** Hooks implemented outside the engine (connectors, child cases). */
  services: EngineServices;
}

/** Side effects that need the API's services (wired by the Restate controller). */
export interface EngineServices {
  /** Call a connector action (connector components). */
  invokeConnector?(input: ConnectorInvocation): Promise<ConnectorInvocationResult>;
  /** A child case ended: resolve the promise its parent step waits on. */
  notifyParent?(tenantId: string, childCaseId: string, signal: TaskSignal): Promise<void>;
  /** Send a workflow's message to one webhook subscription of the institution (`live.publish` to a webhook). */
  sendCaseMessage?(input: { tenantId: string; caseId: string; reference: string; subscriptionId: string; step: string; message: Record<string, unknown> }): Promise<{ delivered: boolean; eventId?: string; error?: string }>;
  /** Start a child case on a published workflow (workflow.call / foreach). */
  startChildCase?(input: { tenantId: string; parentCaseId: string; parentStepId: string; workflowId: string; data: Record<string, unknown>; applicantId?: string | null; partyId?: string | null; callbackPromise: string | null }): Promise<{ caseId: string; reference: string }>;
}

export interface ConnectorInvocation {
  tenantId: string;
  caseId: string;
  stepId: string;
  componentType: string;
  config: Record<string, unknown>;
  input: Record<string, unknown>;
  idempotencyKey: string;
  /** Durable promise the connector resolves through the connector API (async components). */
  callbackPromise: string;
}

export type ConnectorInvocationResult =
  | { mode: 'sync'; outcome: string; output: Record<string, unknown> }
  | { mode: 'async'; ref?: string; clientAction?: { type: 'redirect' | 'embed' | 'sdk'; url: string; title?: string; instructions?: string; sdk?: string } };

export const WORKFLOW_ACTOR = { type: 'workflow' };

export interface StepContext {
  ctx: restate.WorkflowContext;
  step: StepDefinition;
  /** Unique label of this execution of the step (journal entry names). */
  label: string;
  /** Step config with expressions and templates resolved. */
  config: Record<string, any>;
  vars: Record<string, any>;
  tenantId: string;
  caseId: string;
  deps: EngineDeps;
}

export interface EngineComponent {
  definition: ComponentDefinition;
  /** Resolve `=expressions`/`{{templates}}` in the config before executing (default true). */
  resolveConfig?: boolean;
  execute(step: StepContext): Promise<StepResult>;
  /** Extra publish-time checks beyond the JSON schema. */
  validate?(config: Record<string, any>, context: { roles?: string[] }): string[];
}
