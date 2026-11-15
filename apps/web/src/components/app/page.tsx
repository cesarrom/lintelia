import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** Page title with description and actions. */
export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-2">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('container mx-auto py-10 space-y-6', className)}>{children}</div>;
}

const ACRONYMS = new Set(['sar', 'aml', 'kyc', 'kyb', 'mlro', 'pep', 'fiu', 'api', 'sla', 'ubo']);

/** `file_sar` → `File SAR`, `in_review` → `In review`. */
export const humanize = (value: string | null | undefined) =>
  value
    ? value.replace(/[_.:-]+/g, ' ').split(' ').map((word) => (ACRONYMS.has(word.toLowerCase()) ? word.toUpperCase() : word)).join(' ')
      .replace(/^\w/, (c) => c.toUpperCase())
    : '';

const STATUS_STYLES: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  suspended: 'bg-red-100 text-red-800 border-red-200',
  closed: 'bg-slate-200 text-slate-800 border-slate-300',
  cancelled: 'bg-slate-200 text-slate-800 border-slate-300',
  expired: 'bg-slate-200 text-slate-800 border-slate-300',
  in_review: 'bg-amber-100 text-amber-800 border-amber-200',
  open: 'bg-sky-100 text-sky-800 border-sky-200',
  claimed: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  escalated: 'bg-orange-100 text-orange-800 border-orange-200',
  pending_second_approval: 'bg-purple-100 text-purple-800 border-purple-200',
  pending_client: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  waiting_for_you: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  high: 'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  low: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

/** Coloured badge for case/task/tenant statuses and risk levels. */
export function StatusBadge({ status, label }: { status: string | null | undefined; label?: string }) {
  if (!status) return null;
  return (
    <Badge variant="outline" className={cn('whitespace-nowrap', STATUS_STYLES[status])} data-status={status}>
      {label ?? humanize(status)}
    </Badge>
  );
}

export const formatDate = (value: string | Date | null | undefined) =>
  value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export const formatValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

/** Definition list of key/value pairs (case data, results). */
export function KeyValues({ data, labels = {} }: { data: Record<string, unknown> | null | undefined; labels?: Record<string, string> }) {
  const entries = Object.entries(data ?? {});
  if (!entries.length) return <p className="text-sm text-muted-foreground">Nothing recorded.</p>;
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key}>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{labels[key] ?? humanize(key.replace(/([a-z])([A-Z])/g, '$1 $2'))}</dt>
          <dd className="text-sm break-words" data-field={key}>{formatValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">{children}</div>;
}
