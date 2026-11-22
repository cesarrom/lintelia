import { ChevronRight, Loader2 } from 'lucide-react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils';
import { filterItems, resolveItemValue, resolveProps, useResolved, type Scope } from '../expressions';
import { appCurrency, formatAs } from '../format';
import { AppIcon } from '../icons';
import { Empty, WidgetCard, itemsOf, sortItems, useLink, type WidgetProps } from './shared';

/** Items of the widget's source, filtered, sorted and limited. */
function useItems(props: Record<string, any>, scope: Scope) {
  return useResolved(async () => {
    const items = await filterItems(itemsOf(props.source, scope), props.filter, scope);
    const sorted = sortItems(items, props.sort, props.descending);
    const limit = Number(props.limit);
    return limit > 0 ? sorted.slice(0, limit) : sorted;
  }, [props.source, props.filter, props.sort, props.descending, props.limit, scope]);
}

export function StatWidget({ props, scope }: WidgetProps) {
  const p = useResolved(() => resolveProps(props, scope), [props, scope]) ?? {};
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card" data-testid="stat">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground">{String(p.label ?? '')}</p>
        {!!props.icon && <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary"><AppIcon name={String(props.icon)} className="h-4 w-4" /></span>}
      </div>
      <p className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.02em] tabular" data-testid="stat-value">{p.value === undefined ? '—' : formatAs(p.value, String(p.format ?? 'number'), String(p.currency ?? appCurrency())) || '—'}</p>
      {!!p.hint && <p className="mt-1.5 text-xs text-muted-foreground">{String(p.hint)}</p>}
    </div>
  );
}

interface ListRow {
  item: Record<string, any>;
  title: string;
  subtitle: string;
  value: unknown;
}

export function ListWidget({ props, scope }: WidgetProps) {
  const items = useItems(props, scope);
  const link = useLink();
  const rows = useResolved(async () => Promise.all((items ?? []).map(async (item): Promise<ListRow> => ({
    item,
    title: String(await resolveItemValue(props.itemTitle ?? '{{item.name}}', item, scope) ?? ''),
    subtitle: String(await resolveItemValue(props.itemSubtitle ?? '', item, scope) ?? ''),
    value: props.itemValue ? await resolveItemValue(props.itemValue, item, scope) : undefined,
  }))), [items, props.itemTitle, props.itemSubtitle, props.itemValue, scope]);
  const clickable = link.has(props);
  return (
    <WidgetCard title={props.title} testId="list">
      {rows === undefined ? <div className="h-24" /> : rows.length === 0 ? <Empty>{props.empty || 'Nothing yet.'}</Empty> : (
        <ul className="divide-y">
          {rows.map((row, i) => {
            const content = (
              <>
                {!!props.icon && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><AppIcon name={String(props.icon)} className="h-4 w-4" /></span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-medium">{row.title}</span>
                  {row.subtitle && <span className="block truncate text-xs text-muted-foreground">{row.subtitle}</span>}
                </span>
                {row.value !== undefined && <span className="shrink-0 text-sm font-medium tabular">{formatAs(row.value, props.valueFormat ?? 'text', String(row.item.currency ?? props.currency ?? appCurrency()))}</span>}
                {clickable && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />}
              </>
            );
            return (
              <li key={String(row.item.key ?? row.item.id ?? i)} data-testid="list-item">
                {clickable
                  ? <button type="button" onClick={() => void link.go(props, row.item, scope)} className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/40">{content}</button>
                  : <div className="flex items-center gap-3 px-5 py-3">{content}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
}

export function TableWidget({ props, scope }: WidgetProps) {
  const items = useItems(props, scope);
  const columns = (Array.isArray(props.columns) ? props.columns : []) as Array<{ field?: string; label?: string; format?: string }>;
  return (
    <WidgetCard title={props.title} testId="table">
      {items === undefined ? <div className="h-24" /> : items.length === 0 ? <Empty>{props.empty || 'Nothing yet.'}</Empty> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">{columns.map((c, i) => <th key={i} className={cn('px-5 py-2.5 font-medium', ['money', 'number', 'percent'].includes(c.format ?? '') && 'text-right')}>{c.label ?? c.field}</th>)}</tr></thead>
            <tbody className="divide-y">
              {items.map((item, i) => (
                <tr key={String(item.key ?? i)}>
                  {columns.map((c, j) => <td key={j} className={cn('px-5 py-2.5', ['money', 'number', 'percent'].includes(c.format ?? '') && 'text-right tabular')}>{formatAs(c.field ? item[c.field] : '', c.format ?? 'text', item.currency ?? appCurrency())}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </WidgetCard>
  );
}

/** `me`, or the item of a collection whose key is the page parameter `key` (the first item without one). */
export function DetailsWidget({ props, scope }: WidgetProps) {
  const fields = (Array.isArray(props.fields) ? props.fields : []) as Array<{ path?: string; label?: string; format?: string }>;
  const source = String(props.source ?? 'me');
  const params = (scope.params ?? {}) as Record<string, string>;
  // A collection item: the one named by the page parameter `key`, or (page without one, e.g. "My loan") the first.
  const items = source === 'me' ? [] : itemsOf(source, scope);
  const item = source === 'me' ? (scope.me as Record<string, any> | undefined) : (params.key ? items.find((i) => String(i.key) === params.key) : items[0]) ?? null;
  const values = useResolved(async () => Promise.all(fields.map(async (f) => (f.path ? resolveItemValue(`= ${f.path}`, item, scope) : undefined))), [fields, item, scope]);
  if (!item) return <WidgetCard title={props.title}><Empty>Not found.</Empty></WidgetCard>;
  const shown = fields.map((f, i) => ({ ...f, value: values?.[i] })).filter((f) => f.value !== undefined && f.value !== null && f.value !== '');
  return (
    <WidgetCard title={props.title} testId="details">
      <dl className="grid gap-px overflow-hidden rounded-2xl bg-border sm:grid-cols-2">
        {shown.map((f, i) => (
          <div key={i} className={cn('bg-card px-5 py-3.5', shown.length % 2 === 1 && i === shown.length - 1 && 'sm:col-span-2')}>
            <dt className="text-xs text-muted-foreground">{f.label ?? f.path}</dt>
            <dd className="mt-0.5 text-[15px] font-medium tabular" data-testid={`detail-${f.path}`}>{formatAs(f.value, f.format ?? 'text', item.currency ?? appCurrency())}</dd>
          </div>
        ))}
      </dl>
    </WidgetCard>
  );
}

const PALETTE = ['hsl(var(--primary))', 'hsl(var(--primary) / 0.72)', 'hsl(var(--primary) / 0.5)', 'hsl(var(--primary) / 0.32)', 'hsl(var(--primary) / 0.2)', 'hsl(var(--muted-foreground) / 0.35)', 'hsl(var(--muted-foreground) / 0.2)'];

/** Totals of `value` grouped by `groupBy`: a doughnut with a legend, or bars. */
export function ChartWidget({ props, scope }: WidgetProps) {
  const items = useResolved(async () => filterItems(itemsOf(props.source, scope), props.filter, scope), [props.source, props.filter, scope]);
  const groups = new Map<string, number>();
  for (const item of items ?? []) {
    const key = String(item[props.groupBy ?? 'category'] ?? 'Other');
    const n = Number(item[props.value ?? 'amount']) || 0;
    groups.set(key, (groups.get(key) ?? 0) + (props.absolute ? Math.abs(n) : n));
  }
  const data = [...groups.entries()].map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value);
  const top = data.length > 6 ? [...data.slice(0, 5), { name: 'Other', value: data.slice(5).reduce((s, d) => s + d.value, 0) }] : data;
  const total = top.reduce((s, d) => s + d.value, 0);
  const fmt = (v: number) => formatAs(v, props.format ?? 'number', props.currency ?? appCurrency());
  return (
    <WidgetCard title={props.title} testId="chart">
      {items === undefined ? <div className="h-48" /> : !top.length ? <Empty>Nothing to show yet.</Empty> : props.kind === 'bar' ? (
        <div className="h-64 px-3 py-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top} margin={{ left: 8, right: 8 }}>
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} width={56} tickFormatter={(v) => fmt(Number(v)).replace(/\.00$/, '')} />
              <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} formatter={(v) => fmt(Number(v))} contentStyle={{ borderRadius: 10, border: '1px solid hsl(var(--border))', fontSize: 12 }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="grid items-center gap-4 p-5 sm:grid-cols-[180px_1fr]">
          <div className="relative mx-auto h-[180px] w-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={top} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={2} stroke="none">
                  {top.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ borderRadius: 10, border: '1px solid hsl(var(--border))', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[11px] text-muted-foreground">Total</span>
              <span className="text-base font-semibold tabular" data-testid="chart-total">{fmt(total)}</span>
            </div>
          </div>
          <ul className="space-y-2 text-sm">
            {top.map((d, i) => (
              <li key={d.name} className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                <span className="min-w-0 flex-1 truncate">{d.name}</span>
                <span className="tabular text-muted-foreground">{total ? Math.round((d.value / total) * 100) : 0}%</span>
                <span className="w-24 text-right font-medium tabular">{fmt(d.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </WidgetCard>
  );
}

/** Used vs limit per item (budgets, goals). */
export function ProgressListWidget({ props, scope }: WidgetProps) {
  const rows = useResolved(async () => Promise.all(itemsOf(props.source, scope).map(async (item) => ({
    key: String(item.key),
    label: String(await resolveItemValue(props.label ?? '{{item.name}}', item, scope) ?? ''),
    current: Number(await resolveItemValue(props.current ?? '= current', item, scope)) || 0,
    target: Number(await resolveItemValue(props.target ?? '= target', item, scope)) || 0,
  }))), [props, scope]);
  const fmt = (v: number) => formatAs(v, props.format ?? 'number', props.currency ?? appCurrency());
  return (
    <WidgetCard title={props.title} testId="progress-list">
      {rows === undefined ? <div className="flex h-24 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div> : !rows.length ? <Empty>Nothing yet.</Empty> : (
        <ul className="space-y-4 p-5">
          {rows.map((row) => {
            const ratio = row.target > 0 ? row.current / row.target : 0;
            return (
              <li key={row.key} data-testid="progress-item">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{row.label}</span>
                  <span className="tabular text-muted-foreground"><span className={cn('font-medium', ratio > 1 ? 'text-destructive' : 'text-foreground')}>{fmt(row.current)}</span> of {fmt(row.target)}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <span className={cn('block h-full rounded-full transition-[width] duration-500', ratio > 1 ? 'bg-destructive' : ratio > 0.85 ? 'bg-warning' : 'bg-primary')} style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
}
