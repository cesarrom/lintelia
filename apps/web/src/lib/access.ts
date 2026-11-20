import { toast } from 'sonner';

/** An access change (docs/plans/15 §14), as `GET /access-changes` returns it. */
export interface AccessChange {
  id: string;
  kind: string;
  summary: string;
  diff: Record<string, unknown>;
  grants: boolean;
  status: 'pending_approval' | 'scheduled' | 'applied' | 'rejected' | 'cancelled' | 'expired' | 'failed';
  requestedBy: { id: string | null; email: string | null; type: string };
  effectiveAt: string | null;
  approvedBy: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  appliedAt: string | null;
  error: string | null;
  expiresAt: string | null;
  createdAt: string;
  canApprove: boolean;
  canCancel: boolean;
}

/** What change-controlled routes answer when the change waits: `202 { pending, status, change }`. */
export interface PendingOutcome {
  pending: true;
  status: 'pending_approval' | 'scheduled';
  change: AccessChange;
}

export const isPending = (result: unknown): result is PendingOutcome => !!result && typeof result === 'object' && (result as PendingOutcome).pending === true;

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');

/**
 * Tell the person what happened to their change: applied, waiting for a second administrator, or scheduled.
 * Returns the outcome so callers can close dialogs or keep them.
 */
export function announceChange(result: unknown, applied: string): 'applied' | 'pending_approval' | 'scheduled' {
  if (isPending(result)) {
    if (result.status === 'scheduled') {
      toast.info(`Scheduled for ${when(result.change.effectiveAt)}`, { description: result.change.summary });
      return 'scheduled';
    }
    toast.info('Sent for approval: another administrator must approve it', { description: result.change.summary });
    return 'pending_approval';
  }
  toast.success(applied);
  return 'applied';
}

export const CHANGE_STATUS_LABEL: Record<AccessChange['status'], string> = {
  pending_approval: 'Waiting for approval', scheduled: 'Scheduled', applied: 'Applied', rejected: 'Rejected', cancelled: 'Cancelled', expired: 'Expired', failed: 'Failed',
};

export const SOURCE_LABEL: Record<string, string> = {
  manual: 'Assigned in Lintelia', idp: 'From your identity provider', default: 'Default role (just in time)', recovery: 'Restored by platform support',
};
