import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { EmptyState, PageContainer, PageHeader, StatusBadge, formatDate, formatRelative } from '@/components/app/page';
import { Avatar } from '@/components/brand/Monogram';
import { Search } from 'lucide-react';
import { useApiQuery } from '@/lib/services/api';

export interface ClientSummary {
  id: string;
  email: string;
  name: string | null;
  status: string;
  createdAt: string;
  cases: number;
}

/** The institution's clients (end users). */
export default function ClientsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { data: clients = [], isLoading } = useApiQuery<ClientSummary[]>(['clients', 'list', search], `/clients${search ? `?search=${encodeURIComponent(search)}` : ''}`);

  return (
    <PageContainer>
      <PageHeader title="Clients" description="People who applied or hold a relationship with your institution" />
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by name or e-mail" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {!isLoading && clients.length === 0 ? <EmptyState art={search ? 'search' : 'clients'}>No clients found.</EmptyState> : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Name</TableHead><TableHead>E-mail</TableHead><TableHead>Cases</TableHead><TableHead>Status</TableHead><TableHead>Since</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" data-testid="client-row" data-email={c.email} onClick={() => navigate(`/app/clients/${c.id}`)}>
                  <TableCell className="font-medium"><span className="flex items-center gap-2.5"><Avatar name={c.name} email={c.email} size="sm" />{c.name || '—'}</span></TableCell>
                  <TableCell className="text-muted-foreground">{c.email}</TableCell>
                  <TableCell className="tabular">{c.cases}</TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground" title={formatDate(c.createdAt)}>{formatRelative(c.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PageContainer>
  );
}
