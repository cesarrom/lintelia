import type { ComponentType, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useLocation } from 'react-router';
import { cn } from '@/lib/utils';
import { memberRoutes, staffRoutes } from '@/lib/routes/routes';
import { ART, type ArtName } from '@/components/brand/illustrations';

/** Page title with description and actions; optionally an icon tile and an eyebrow line above the title. */
export function PageHeader({ title, description, actions, icon, eyebrow, className }: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: LucideIcon;
  eyebrow?: ReactNode;
  className?: string;
}) {
  // Pages of the navigation get their menu icon unless they bring their own.
  const { pathname } = useLocation();
  const Icon = icon ?? [...memberRoutes, ...staffRoutes].find((r) => r.href === pathname)?.icon;
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-x-6 gap-y-4', className)}>
      <div className="flex min-w-0 items-start gap-4">
        {Icon && (
          <span className="mt-0.5 hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-card text-primary shadow-xs sm:flex">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && <div className="mb-1 text-[13px] font-medium text-muted-foreground">{eyebrow}</div>}
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em]">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** The content column of a back-office page. */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-[1280px] space-y-6 px-5 py-7 sm:px-8 lg:px-10 lg:py-9', className)}>{children}</div>;
}

/** A titled section inside a page. */
export function SectionHeader({ title, description, actions, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-end justify-between gap-4', className)}>
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

/** Rounded, bordered container for tables (keeps the header row flush with the card edge). */
export function TableCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('overflow-hidden rounded-xl border bg-card shadow-card', className)}>{children}</div>;
}

const ACRONYMS = new Set(['sar', 'aml', 'kyc', 'kyb', 'mlro', 'pep', 'fiu', 'api', 'sla', 'ubo']);

/** `file_sar` → `File SAR`, `in_review` → `In review`. */
export const humanize = (value: string | null | undefined) =>
  value
    ? value.replace(/[_.:-]+/g, ' ').split(' ').map((word) => (ACRONYMS.has(word.toLowerCase()) ? word.toUpperCase() : word)).join(' ')
      .replace(/^\w/, (c) => c.toUpperCase())
    : '';

type Tone = 'success' | 'danger' | 'warning' | 'info' | 'brand' | 'orange' | 'neutral';

const TONES: Record<Tone, { pill: string; dot: string }> = {
  success: { pill: 'bg-success-soft text-success ring-success/20', dot: 'bg-success' },
  danger: { pill: 'bg-destructive/[0.08] text-destructive ring-destructive/20', dot: 'bg-destructive' },
  warning: { pill: 'bg-warning-soft text-[hsl(30_85%_34%)] ring-warning/25 dark:text-warning', dot: 'bg-warning' },
  info: { pill: 'bg-info-soft text-info ring-info/20', dot: 'bg-info' },
  brand: { pill: 'bg-primary-soft text-primary ring-primary/20', dot: 'bg-primary' },
  orange: { pill: 'bg-orange-500/10 text-orange-700 ring-orange-500/25 dark:text-orange-300', dot: 'bg-orange-500' },
  neutral: { pill: 'bg-muted text-muted-foreground ring-border', dot: 'bg-muted-foreground/60' },
};

const STATUS_TONE: Record<string, Tone> = {
  approved: 'success', completed: 'success', active: 'success', verified: 'success', signed: 'success', done: 'success', published: 'success', answered: 'success',
  rejected: 'danger', suspended: 'danger', failed: 'danger', declined: 'danger', high: 'danger',
  closed: 'neutral', cancelled: 'neutral', expired: 'neutral', draft: 'neutral', revoked: 'neutral', archived: 'neutral', inactive: 'neutral', deactivated: 'neutral',
  in_review: 'warning', pending_client: 'warning', waiting_for_you: 'warning', medium: 'warning', pending: 'warning',
  open: 'info', submitted: 'info', in_progress: 'info', invited: 'info',
  claimed: 'brand', pending_second_approval: 'brand',
  escalated: 'orange',
  low: 'success',
};

/** Pill for case/task/tenant statuses and risk levels: a coloured dot and the label. */
export function StatusBadge({ status, label, className }: { status: string | null | undefined; label?: string; className?: string }) {
  if (!status) return null;
  const tone = TONES[STATUS_TONE[status] ?? 'neutral'];
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium leading-4 ring-1 ring-inset', tone.pill, className)}
      data-status={status}
    >
      <span aria-hidden="true" className={cn('h-1.5 w-1.5 shrink-0 rounded-full', tone.dot)} />
      {label ?? humanize(status)}
    </span>
  );
}

export const formatDate = (value: string | Date | null | undefined) =>
  value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

/** "just now", "5 min ago", "3 h ago", "2 days ago", then the date. */
export const formatRelative = (value: string | Date | null | undefined) => {
  if (!value) return '—';
  const seconds = (Date.now() - new Date(value).getTime()) / 1000;
  const future = seconds < 0;
  const s = Math.abs(seconds);
  const say = (n: number, unit: string) => (future ? `in ${n} ${unit}` : `${n} ${unit} ago`);
  if (s < 45) return future ? 'in a moment' : 'just now';
  if (s < 3600) return say(Math.round(s / 60), 'min');
  if (s < 86_400) return say(Math.round(s / 3600), 'h');
  if (s < 7 * 86_400) return say(Math.round(s / 86_400), Math.round(s / 86_400) === 1 ? 'day' : 'days');
  return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
};

const isFileRef = (v: unknown): v is { name: string; fileId: string } => !!v && typeof v === 'object' && typeof (v as { fileId?: unknown }).fileId === 'string' && typeof (v as { name?: unknown }).name === 'string';

export const formatValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  // Four-digit whole numbers (years, codes) read better without a separator.
  if (typeof value === 'number') return Number.isInteger(value) && Math.abs(value) < 10_000 ? String(value) : value.toLocaleString();
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  // Uploaded files: their names.
  if (isFileRef(value)) return value.name;
  if (Array.isArray(value) && value.length && value.every(isFileRef)) return value.map((f) => f.name).join(', ');
  if (Array.isArray(value) && value.every((v) => ['string', 'number', 'boolean'].includes(typeof v))) return value.map((v) => formatValue(v)).join(', ') || '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

/** Definition list of key/value pairs (case data, results). */
export function KeyValues({ data, labels = {} }: { data: Record<string, unknown> | null | undefined; labels?: Record<string, string> }) {
  const entries = Object.entries(data ?? {});
  if (!entries.length) return <p className="text-sm text-muted-foreground">Nothing recorded.</p>;
  return (
    <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="min-w-0 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
          <dt className="text-xs text-muted-foreground">{labels[key] ?? humanize(key.replace(/([a-z])([A-Z])/g, '$1 $2'))}</dt>
          <dd className="mt-0.5 break-words text-sm font-medium tabular" data-field={key}>{formatValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Nothing here yet: an illustration, an optional title and the explanation (and an action). */
export function EmptyState({ children, art, title, action, className }: { children?: ReactNode; art?: ArtName; title?: ReactNode; action?: ReactNode; className?: string }) {
  const Art: ComponentType<{ className?: string }> | undefined = art ? ART[art] : undefined;
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/60 px-6 py-10 text-center', className)}>
      {Art && <Art className="mb-3 w-40" />}
      {title && <p className="text-[15px] font-semibold text-foreground">{title}</p>}
      {children && <div className={cn('max-w-md text-sm text-muted-foreground', title && 'mt-1')}>{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** A number with its label, for overview pages. */
export function StatCard({ label, value, hint, icon: Icon, tone = 'brand', onClick, testId }: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: 'brand' | 'success' | 'warning' | 'info' | 'danger';
  onClick?: () => void;
  testId?: string;
}) {
  const tones = {
    brand: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/15 text-[hsl(30_85%_38%)] dark:text-warning',
    info: 'bg-info/10 text-info',
    danger: 'bg-destructive/10 text-destructive',
  };
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      data-testid={testId}
      className={cn(
        'group relative flex flex-col rounded-xl border bg-card p-4 text-left shadow-card transition',
        onClick && 'hover:-translate-y-px hover:border-primary/30 hover:shadow-raised focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        {Icon && <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', tones[tone])}><Icon className="h-4 w-4" /></span>}
      </div>
      <span className="mt-2 text-[28px] font-semibold leading-none tracking-tight tabular">{value}</span>
      {hint && <span className="mt-2 text-xs text-muted-foreground">{hint}</span>}
    </Comp>
  );
}
