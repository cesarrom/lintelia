import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { EmptyState, PageContainer, PageHeader, formatDate, humanize } from '@/components/app/page';
import { useApiQuery } from '@/lib/services/api';

interface PlatformAuditEntry {
  id: string;
  seq: number;
  at: string;
  actor: { type: string; email: string | null };
  action: string;
  target: { type: string | null; id: string | null };
  tenant: string | null;
  details: Record<string, unknown>;
}

/** What platform staff did: onboarding, suspensions, deletions, staff changes, support access. */
export default function PlatformAuditPage() {
  const [tenant, setTenant] = useState('');
  const { data: entries = [], isLoading } = useApiQuery<PlatformAuditEntry[]>(['platform', 'audit', tenant], `/platform/audit${tenant ? `?tenant=${encodeURIComponent(tenant)}` : ''}`);
  return (
    <PageContainer>
      <PageHeader title="Platform audit log" description="Append-only and hash-chained, like the institutions' own audit logs" />
      <Input placeholder="Filter by workspace key" className="max-w-sm" value={tenant} onChange={(e) => setTenant(e.target.value.trim())} />
      {!isLoading && entries.length === 0 ? <EmptyState art="documents">No entries.</EmptyState> : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader><TableRow><TableHead>#</TableHead><TableHead>When</TableHead><TableHead>Who</TableHead><TableHead>What</TableHead><TableHead>Institution</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id} data-testid="platform-audit-row" data-action={e.action}>
                  <TableCell className="font-mono text-xs">{e.seq}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{formatDate(e.at)}</TableCell>
                  <TableCell className="text-sm">{e.actor.email ?? humanize(e.actor.type)}</TableCell>
                  <TableCell className="text-sm">{humanize(e.action)}</TableCell>
                  <TableCell className="font-mono text-xs">{e.tenant ?? '—'}</TableCell>
                  <TableCell className="max-w-md truncate font-mono text-xs" title={JSON.stringify(e.details)}>{JSON.stringify(e.details)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PageContainer>
  );
}
