import { formatDate, humanize } from './page';

export interface AuditEntry {
  id: string;
  seq: number;
  at: string;
  actor: { type: string; id: string | null; email: string | null };
  action: string;
  target: { type: string; id: string | null; [key: string]: unknown };
  caseId: string | null;
  details: Record<string, unknown>;
  hash: string;
}

const ACTION_LABELS: Record<string, string> = {
  'case.drafted': 'Application received (waiting for e-mail confirmation)',
  'case.created': 'Case opened',
  'case.submitted': 'Application submitted',
  'case.started': 'Workflow started',
  'case.updated': 'Case updated',
  'case.approved': 'Case approved',
  'case.rejected': 'Case rejected',
  'case.closed': 'Case closed',
  'case.exported': 'Evidence pack exported',
  'case.confirmed_by_client': 'Client confirmed the application',
  'case.link_resent': 'Link re-sent to the client',
  'task.created': 'Task created',
  'task.claimed': 'Task claimed',
  'task.assigned': 'Task reassigned',
  'task.escalated': 'Task escalated (SLA breached)',
  'task.first_approval': 'First approval (four-eyes)',
  'task.decided': 'Decision recorded',
  'task.information_requested': 'Information requested from the client',
  'client_request.created': 'Request sent to the client',
  'client_request.answered': 'Client answered',
  'client_request.reminded': 'Client reminded',
  'client_request.expired': 'Client request expired',
};

export const actionLabel = (action: string) => ACTION_LABELS[action] ?? humanize(action);

const describe = (entry: AuditEntry) => {
  const d = entry.details ?? {};
  const parts: string[] = [];
  if (typeof entry.target.title === 'string') parts.push(entry.target.title);
  if (d.outcome) parts.push(`outcome: ${humanize(String(d.outcome))}`);
  if (d.reason) parts.push(`“${String(d.reason)}”`);
  if (d.queue) parts.push(`queue: ${humanize(String(d.queue))}`);
  if (d.to) parts.push(`to: ${String(d.to)}`);
  if (d.riskLevel) parts.push(`risk: ${String(d.riskLevel)}`);
  return parts.join(' · ');
};

/** Chronological, tamper-evident (hash-chained) history of a case. */
export function Timeline({ entries }: { entries: AuditEntry[] }) {
  if (!entries.length) return <p className="text-sm text-muted-foreground">No events yet.</p>;
  return (
    <ol className="relative space-y-4 border-l pl-6" data-testid="timeline">
      {entries.map((entry) => (
        <li key={entry.id} className="relative" data-action={entry.action}>
          <span className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
          <p className="text-sm font-medium">{actionLabel(entry.action)}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(entry.at)} · {entry.actor.email ?? humanize(entry.actor.type)}
            {describe(entry) && <> · {describe(entry)}</>}
          </p>
        </li>
      ))}
    </ol>
  );
}
