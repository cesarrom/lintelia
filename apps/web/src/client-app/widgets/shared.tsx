import { Fragment, type ReactNode } from 'react';
import type { ClientWidget } from '@repo/fintivio/schemas';
import { cn } from '@/lib/utils';
import { resolveItemValue, type Scope } from '../expressions';
import { useRuntime } from '../runtime';

export interface WidgetProps {
  widget: ClientWidget;
  /** Raw props (expressions unresolved). */
  props: Record<string, any>;
  scope: Scope;
}

/** A titled block. Widgets without a title render their body only. */
export function WidgetCard({ title, action, children, className, bare, testId }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bare?: boolean; testId?: string }) {
  return (
    <section className={cn(!bare && 'rounded-2xl border bg-card shadow-card', className)} data-testid={testId}>
      {(title || action) && (
        <div className={cn('flex items-center justify-between gap-3', bare ? 'mb-3' : 'border-b px-5 py-3.5')}>
          {title ? <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2> : <span />}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export interface LinkProps {
  journey?: string;
  /** How the journey opens ('' : as the journey says). */
  presentation?: '' | 'page' | 'dialog' | 'sheet' | 'fullscreen';
  input?: Record<string, unknown>;
  page?: string;
  params?: Record<string, unknown>;
  url?: string;
}

const resolveMap = async (map: Record<string, unknown> | undefined, item: unknown, scope: Scope) => {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(map ?? {})) {
    const resolved = await resolveItemValue(value, item, scope);
    if (resolved !== undefined && resolved !== null) out[key] = String(resolved);
  }
  return out;
};

/** What a click does: start a journey (inputs may use the item), open a page (with parameters) or a web address. */
export function useLink() {
  const runtime = useRuntime();
  return {
    has: (link: LinkProps) => !!(link.journey || link.page || link.url),
    go: async (link: LinkProps, item: unknown, scope: Scope) => {
      if (link.journey) return runtime.startJourney(link.journey, await resolveMap(link.input, item, scope), { presentation: link.presentation });
      if (link.page) return runtime.openPage(link.page, await resolveMap(link.params, item, scope));
      if (link.url && /^https:\/\//.test(link.url)) window.open(link.url, '_blank', 'noopener,noreferrer');
    },
    starting: runtime.starting,
  };
}

/** Inline formatting: **bold**, [label](https://…). Text only, never HTML. */
function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g);
  return parts.map((part, i) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) return <strong key={i} className="font-semibold">{bold[1]}</strong>;
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link && /^(https:\/\/|mailto:|tel:)/.test(link[2])) return <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-2 hover:underline">{link[1]}</a>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/** Paragraphs and bullet lists ("- item") with inline formatting. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className={cn('space-y-2.5 text-[14.5px] leading-relaxed', className)}>
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          return <ul key={i} className="list-disc space-y-1 pl-5">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-*]\s+/, ''))}</li>)}</ul>;
        }
        return <p key={i}>{lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l)}</Fragment>)}</p>;
      })}
    </div>
  );
}

/** Items of a source (`records:accounts`, `cases`…) from the page scope. */
export function itemsOf(source: unknown, scope: Scope): Array<Record<string, any>> {
  if (typeof source !== 'string' || !source) return [];
  if (source.startsWith('records:')) return ((scope.records as Record<string, unknown[]> | undefined)?.[source.slice(8)] ?? []) as Array<Record<string, any>>;
  if (source === 'me') return scope.me ? [scope.me as Record<string, any>] : [];
  const value = scope[source];
  return Array.isArray(value) ? value : [];
}

/** Sort by a field (numbers, dates, text). */
export function sortItems<T extends Record<string, any>>(items: T[], field: unknown, descending: unknown): T[] {
  if (typeof field !== 'string' || !field) return items;
  const sorted = [...items].sort((a, b) => {
    const x = a[field];
    const y = b[field];
    if (typeof x === 'number' && typeof y === 'number') return x - y;
    return String(x ?? '').localeCompare(String(y ?? ''), 'en', { numeric: true });
  });
  return descending ? sorted.reverse() : sorted;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-5 py-8 text-center text-sm text-muted-foreground" data-testid="widget-empty">{children}</p>;
}
