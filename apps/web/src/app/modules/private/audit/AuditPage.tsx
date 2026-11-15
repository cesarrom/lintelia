import { useState } from 'react';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState, PageContainer, PageHeader, formatDate, humanize } from '@/components/app/page';
import { actionLabel, type AuditEntry } from '@/components/app/timeline';
import { useAuth } from '@/lib/auth/AuthContext';
import { useAxios } from '@/lib/services/axios';
import { apiErrorMessage, useApiQuery } from '@/lib/services/api';

const API_BASE_URL = import.meta.env.VITE_FILES_API_BASE_URL as string;

/** Append-only, hash-chained audit log of the institution. */
export default function AuditPage() {
  const { hasPermission } = useAuth();
  const { axios } = useAxios();
  const [action, setAction] = useState('');
  const { data: entries = [], isLoading } = useApiQuery<AuditEntry[]>(['audit', action], `/audit?limit=200${action ? `&action=${encodeURIComponent(action)}` : ''}`);

  const onExport = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/audit/export`, { responseType: 'text' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([response.data], { type: 'application/x-ndjson' }));
      link.download = 'audit.jsonl';
      link.click();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Audit log"
        description="Every sign-in, change and decision, in order. Entries are chained by hash so tampering is detectable."
        actions={hasPermission('audit:export') && <Button variant="outline" onClick={onExport}><Download className="h-4 w-4 mr-2" />Export (JSON Lines)</Button>}
      />
      <Input placeholder="Filter by action, e.g. task.decided" className="max-w-sm" value={action} onChange={(e) => setAction(e.target.value.trim())} />
      {!isLoading && entries.length === 0 ? <EmptyState>No entries.</EmptyState> : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow><TableHead>#</TableHead><TableHead>When</TableHead><TableHead>Who</TableHead><TableHead>What</TableHead><TableHead>Target</TableHead><TableHead>Details</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id} data-testid="audit-row" data-action={e.action}>
                  <TableCell className="font-mono text-xs">{e.seq}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{formatDate(e.at)}</TableCell>
                  <TableCell className="text-sm">{e.actor.email ?? humanize(e.actor.type)}</TableCell>
                  <TableCell className="text-sm">{actionLabel(e.action)}</TableCell>
                  <TableCell className="text-sm">{humanize(e.target.type)} {typeof e.target.name === 'string' ? e.target.name : typeof e.target.email === 'string' ? e.target.email : ''}</TableCell>
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
