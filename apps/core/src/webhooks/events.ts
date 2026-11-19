import { randomBytes } from 'node:crypto';

/**
 * Events institutions can subscribe to (docs/plans/04 §Event catalogue). Payloads are "thin": ids and business status,
 * no personal data; receivers fetch details with an API client. Each type is versioned (`schemaVersion`).
 */
export interface WebhookEventType {
  type: string;
  description: string;
  schemaVersion: number;
  /** Example `data` (documentation and test events). */
  example: Record<string, unknown>;
}

const caseExample = { caseId: '8b0c…', reference: 'C-2026-ABC123', workflow: { id: '1f2e…', version: 2 }, status: 'approved', outcome: 'pre_approved' };

export const WEBHOOK_EVENT_TYPES: WebhookEventType[] = [
  { type: 'case.created', description: 'A case was opened (form submission, API, adviser, event)', schemaVersion: 1, example: { ...caseExample, status: 'submitted', outcome: null } },
  { type: 'case.submitted', description: 'An application was submitted by the client', schemaVersion: 1, example: { ...caseExample, status: 'submitted', outcome: null } },
  { type: 'case.decided', description: 'A case reached a final status (approved, rejected, closed, completed, expired, withdrawn)', schemaVersion: 1, example: caseExample },
  { type: 'case.failed', description: 'A case stopped because of an error', schemaVersion: 1, example: { ...caseExample, status: 'failed', outcome: null } },
  { type: 'task.created', description: 'A task was created for the team (review, approval)', schemaVersion: 1, example: { taskId: '3c4d…', caseId: '8b0c…', kind: 'review', queueRole: 'reviewer' } },
  { type: 'task.completed', description: 'A task was decided', schemaVersion: 1, example: { taskId: '3c4d…', caseId: '8b0c…', decision: 'approve' } },
  { type: 'client.flagged', description: 'A client was flagged (internal subscribers only)', schemaVersion: 1, example: { clientId: '9a8b…', category: 'unusual_activity' } },
  { type: 'data_request.created', description: 'A client asked for their data or its erasure', schemaVersion: 1, example: { dataRequestId: '7e6f…', kind: 'export' } },
  { type: 'data_request.completed', description: "A client's data request was completed", schemaVersion: 1, example: { dataRequestId: '7e6f…', kind: 'export' } },
  { type: 'record.updated', description: 'A connected system wrote a result on a case (verification, signature, message)', schemaVersion: 1, example: { recordId: '5d4c…', caseId: '8b0c…', type: 'verification', status: 'approved' } },
  { type: 'case.message', description: 'A workflow sent a message to this subscription (Send a live message → webhook)', schemaVersion: 1, example: { caseId: '8b0c…', reference: 'C-2026-7QK2M9', step: 'notify_core', message: { status: 'funded' } } },
  { type: 'webhook.test', description: 'Sent by "Send test event"', schemaVersion: 1, example: { message: 'Hello from Fintivio' } },
];

export const WEBHOOK_EVENT_NAMES = new Set(WEBHOOK_EVENT_TYPES.map((e) => e.type));

export const newEventId = () => `evt_${randomBytes(16).toString('base64url')}`;

const FINAL_CASE_ACTIONS = new Set(['case.approved', 'case.rejected', 'case.closed', 'case.completed', 'case.expired', 'case.withdrawn']);

/**
 * The webhook event an audit entry corresponds to, if any. Case events are completed with the case's reference,
 * workflow and status by the writer (it reads the case in the same transaction).
 */
export function eventForAudit(action: string, target: { type?: string | null; id?: string | null } | null | undefined, details: Record<string, unknown>, caseId: string | null | undefined):
  { type: string; caseId?: string | null; data: Record<string, unknown> } | null {
  if (action === 'case.created') return { type: 'case.created', caseId: target?.id ?? caseId, data: {} };
  if (action === 'case.submitted' || action === 'case.confirmed_by_client') return { type: 'case.submitted', caseId: target?.id ?? caseId, data: {} };
  if (FINAL_CASE_ACTIONS.has(action)) return { type: 'case.decided', caseId: target?.id ?? caseId, data: {} };
  if (action === 'case.failed') return { type: 'case.failed', caseId: target?.id ?? caseId, data: {} };
  if (action === 'task.created') return { type: 'task.created', caseId, data: { taskId: target?.id ?? null, kind: details.kind ?? null, queueRole: details.queueRole ?? null } };
  if (action === 'task.decided') return { type: 'task.completed', caseId, data: { taskId: target?.id ?? null, decision: details.decision ?? details.outcome ?? null } };
  if (action === 'client.flagged') return { type: 'client.flagged', data: { clientId: target?.id ?? null, category: details.category ?? null } };
  if (action === 'data_request.created' || action === 'data_request.completed') return { type: action, data: { dataRequestId: target?.id ?? null, kind: details.kind ?? null } };
  if (/^record\.[a-z_]+\.(created|updated)$/.test(action)) return { type: 'record.updated', caseId, data: { recordId: target?.id ?? null, type: target?.type ?? null, status: details.status ?? null } };
  return null;
}
