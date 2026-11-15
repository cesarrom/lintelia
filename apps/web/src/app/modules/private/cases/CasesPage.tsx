import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState, PageContainer, PageHeader, StatusBadge, formatDate, humanize } from '@/components/app/page';
import { useApiQuery } from '@/lib/services/api';
import type { CaseSummary } from './types';

const STATUSES = ['submitted', 'in_progress', 'in_review', 'pending_client', 'approved', 'rejected', 'closed'];

/** Cases in the member's scope (everything with cases:read_all). */
export default function CasesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (status !== 'all') params.set('status', status);
  const { data: cases = [], isLoading } = useApiQuery<CaseSummary[]>(['cases', 'list', search, status], `/cases?${params}`, { refetchInterval: 5000 });

  return (
    <PageContainer>
      <PageHeader title="Cases" description="Applications, investigations and reviews handled by your institution" />
      <div className="flex flex-wrap gap-3">
        <Input placeholder="Search by reference, title or e-mail" className="max-w-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48" aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{humanize(s)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {!isLoading && cases.length === 0 ? <EmptyState>No cases yet.</EmptyState> : (
        <div className="rounded-md border">
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
              {cases.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" data-testid="case-row" data-case-reference={c.reference} onClick={() => navigate(`/app/cases/${c.id}`)}>
                  <TableCell className="font-mono text-xs">{c.reference}</TableCell>
                  <TableCell className="font-medium">{c.title}</TableCell>
                  <TableCell>{c.workflow.name} <span className="text-xs text-muted-foreground">v{c.workflow.version}</span></TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell><StatusBadge status={c.riskLevel} /></TableCell>
                  <TableCell className="text-sm">{humanize(c.source.split(':')[0])}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{formatDate(c.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PageContainer>
  );
}
