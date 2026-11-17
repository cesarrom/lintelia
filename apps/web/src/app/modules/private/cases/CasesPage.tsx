import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Columns3, FolderKanban, Globe, Hand, List, Radio, Search, UserRoundPlus } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, PageContainer, PageHeader, StatusBadge, TableCard, formatDate, formatRelative, humanize } from '@/components/app/page';
import { Avatar } from '@/components/brand/Monogram';
import { useApiQuery } from '@/lib/services/api';
import { cn } from '@/lib/utils';
import type { CaseSummary, Pipeline } from './types';

const STATUSES = ['submitted', 'in_progress', 'in_review', 'pending_client', 'approved', 'rejected', 'closed'];

const SOURCE_ICON: Record<string, typeof Globe> = { form: Globe, event: Radio, manual: Hand, api: Radio, assisted: UserRoundPlus };

/** Cases in the member's scope (everything with cases:read_all). */
export default function CasesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  // Workflows with business stages can be followed as a pipeline board (docs/plans/12).
  const { data: pipelines = [] } = useApiQuery<Pipeline[]>(['cases', 'pipelines'], '/cases/pipelines');
  const [view, setView] = useState<'list' | 'pipeline'>('list');
  const [pipelineId, setPipelineId] = useState<string>('');
  const pipeline = view === 'pipeline' ? pipelines.find((p) => p.id === pipelineId) ?? pipelines[0] : undefined;
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (status !== 'all') params.set('status', status);
  if (pipeline) params.set('workflowId', pipeline.id);
  const { data: cases = [], isLoading } = useApiQuery<CaseSummary[]>(['cases', 'list', search, status, pipeline?.id ?? ''], `/cases?${params}`, { refetchInterval: 5000 });
  const filtered = !!search || status !== 'all';

  return (
    <PageContainer>
      <PageHeader icon={FolderKanban} title="Cases" description="Applications, investigations and reviews handled by your institution" actions={pipelines.length > 0 ? (
        <div className="inline-flex rounded-lg border bg-card p-0.5" role="group" aria-label="View">
          {([['list', List, 'List'], ['pipeline', Columns3, 'Pipeline']] as const).map(([key, Icon, label]) => (
            <button key={key} type="button" onClick={() => setView(key)} aria-pressed={view === key} data-testid={`cases-view-${key}`}
              className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors', view === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
              <Icon className="h-3.5 w-3.5" />{label}
            </button>
          ))}
        </div>
      ) : undefined} />
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by reference, title or e-mail" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48" aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{humanize(s)}</SelectItem>)}
          </SelectContent>
        </Select>
        {pipeline && (
          <Select value={pipeline.id} onValueChange={setPipelineId}>
            <SelectTrigger className="w-64" aria-label="Workflow" data-testid="pipeline-workflow"><SelectValue /></SelectTrigger>
            <SelectContent>{pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
        {!isLoading && <span className="ml-auto text-[13px] text-muted-foreground tabular">{cases.length} {cases.length === 1 ? 'case' : 'cases'}</span>}
      </div>
      {pipeline && !isLoading ? (
        <PipelineBoard pipeline={pipeline} cases={cases} onOpen={(id) => navigate(`/app/cases/${id}`)} />
      ) : isLoading ? (
        <TableCard className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</TableCard>
      ) : cases.length === 0 ? (
        <EmptyState art={filtered ? 'search' : 'cases'} title={filtered ? 'No matching cases' : undefined}>
          {filtered ? 'Try another reference, name or status.' : 'No cases yet.'}
        </EmptyState>
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Workflow</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Opened</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.map((c) => {
                const source = c.source.split(':')[0];
                const SourceIcon = SOURCE_ICON[source] ?? Hand;
                return (
                  <TableRow key={c.id} className="cursor-pointer" data-testid="case-row" data-case-reference={c.reference} onClick={() => navigate(`/app/cases/${c.id}`)}>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{c.reference}</TableCell>
                    <TableCell className="max-w-[340px]">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={c.applicant?.name} email={c.applicant?.email ?? c.title} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{c.title}</p>
                          {c.applicant?.email && <p className="truncate text-xs text-muted-foreground">{c.applicant.email}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.workflow.name} <span className="text-xs text-muted-foreground/70">v{c.workflow.version}</span></TableCell>
                    <TableCell><StatusBadge status={c.status} />{c.stage && <p className="mt-1 text-xs text-muted-foreground" data-testid="case-row-stage">{humanize(c.stage)}</p>}</TableCell>
                    <TableCell>{c.riskLevel ? <StatusBadge status={c.riskLevel} /> : <span className="text-muted-foreground/50">—</span>}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground"><SourceIcon className="h-3.5 w-3.5" />{humanize(source)}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground" title={formatDate(c.createdAt)}>{formatRelative(c.createdAt)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableCard>
      )}
    </PageContainer>
  );
}

/** Cases of one workflow as columns by business stage (the team's pipeline: deals in underwriting, funding…). */
function PipelineBoard({ pipeline, cases, onOpen }: { pipeline: Pipeline; cases: CaseSummary[]; onOpen: (id: string) => void }) {
  const known = new Set(pipeline.stages.map((s) => s.key));
  const columns = [
    ...(cases.some((c) => !c.stage || !known.has(c.stage)) ? [{ key: '', label: 'Not staged yet' }] : []),
    ...pipeline.stages,
  ];
  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2" data-testid="pipeline-board">
      {columns.map((column) => {
        const items = cases.filter((c) => (column.key ? c.stage === column.key : !c.stage || !known.has(c.stage)));
        return (
          <section key={column.key || 'none'} className="flex w-64 shrink-0 flex-col rounded-xl border bg-muted/30" data-testid="pipeline-column" data-stage={column.key}>
            <header className="flex items-center justify-between px-3 py-2.5">
              <h2 className="text-[13px] font-semibold">{column.label}</h2>
              <span className="rounded-full bg-background px-2 text-xs tabular text-muted-foreground ring-1 ring-border">{items.length}</span>
            </header>
            <div className="flex flex-1 flex-col gap-2 px-2 pb-2">
              {items.map((c) => (
                <button key={c.id} type="button" onClick={() => onOpen(c.id)} data-testid="pipeline-card" data-case-reference={c.reference}
                  className="rounded-lg border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/40">
                  <p className="font-mono text-[11px] text-muted-foreground">{c.reference}</p>
                  <p className="mt-0.5 line-clamp-2 text-[13px] font-medium leading-snug">{c.title}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <StatusBadge status={c.status} />
                    <span className="text-[11px] text-muted-foreground" title={formatDate(c.updatedAt)}>{formatRelative(c.updatedAt)}</span>
                  </div>
                </button>
              ))}
              {!items.length && <p className="px-1 py-3 text-center text-xs text-muted-foreground/70">—</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
