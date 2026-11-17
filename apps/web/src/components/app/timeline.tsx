import type { LucideIcon } from 'lucide-react';
import { CheckCircle2, CircleDot, FileCheck2, FileText, Flag, Hand, Link2, MailQuestion, MessageSquareReply, PlayCircle, ShieldCheck, TimerOff, TriangleAlert, UserCheck, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, formatRelative, humanize } from './page';

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

const ICONS: Array<[RegExp, LucideIcon, string]> = [
  [/approved|first_approval|confirmed_by_client|accepted/, CheckCircle2, 'bg-success/10 text-success'],
  [/rejected|declined|refused/, XCircle, 'bg-destructive/10 text-destructive'],
  [/escalated|flagged|expired/, TriangleAlert, 'bg-warning/15 text-[hsl(30_85%_38%)] dark:text-warning'],
  [/decided/, Hand, 'bg-primary/10 text-primary'],
  [/claimed|assigned/, UserCheck, 'bg-primary/10 text-primary'],
  [/information_requested|client_request\.created|reminded/, MailQuestion, 'bg-info/10 text-info'],
  [/answered/, MessageSquareReply, 'bg-info/10 text-info'],
  [/started|submitted|drafted/, PlayCircle, 'bg-primary/10 text-primary'],
  [/exported/, FileCheck2, 'bg-muted text-muted-foreground'],
  [/file\./, FileText, 'bg-muted text-muted-foreground'],
  [/support_access|security|mfa/, ShieldCheck, 'bg-muted text-muted-foreground'],
  [/link/, Link2, 'bg-muted text-muted-foreground'],
  [/closed/, TimerOff, 'bg-muted text-muted-foreground'],
  [/flag/, Flag, 'bg-warning/15 text-warning'],
];

const iconFor = (action: string) => ICONS.find(([pattern]) => pattern.test(action)) ?? [null, CircleDot, 'bg-muted text-muted-foreground'] as const;

/** Chronological, tamper-evident (hash-chained) history of a case. */
export function Timeline({ entries }: { entries: AuditEntry[] }) {
  if (!entries.length) return <p className="text-sm text-muted-foreground">No events yet.</p>;
  return (
    <div>
      <ol className="relative space-y-0" data-testid="timeline">
        {entries.map((entry, i) => {
          const [, Icon, tone] = iconFor(entry.action);
          const detail = describe(entry);
          return (
            <li key={entry.id} className="relative flex gap-3 pb-5 last:pb-0" data-action={entry.action}>
              {i < entries.length - 1 && <span aria-hidden="true" className="absolute left-[13px] top-8 h-[calc(100%-28px)] w-px bg-border" />}
              <span className={cn('relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-4 ring-card', tone)}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-[13px] font-medium leading-snug">{actionLabel(entry.action)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <span title={formatDate(entry.at)}>{formatRelative(entry.at)}</span> · {entry.actor.email ?? humanize(entry.actor.type)}
                </p>
                {detail && <p className="mt-1 break-words text-xs text-muted-foreground/90">{detail}</p>}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-5 flex items-center gap-1.5 border-t pt-3 text-[11.5px] text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-success" /> Tamper-evident: every entry is hash-chained to the previous one.
      </p>
    </div>
  );
}
