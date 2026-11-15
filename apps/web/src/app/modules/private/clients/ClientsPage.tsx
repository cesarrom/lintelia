import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { EmptyState, PageContainer, PageHeader, StatusBadge, formatDate } from '@/components/app/page';
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
      <Input placeholder="Search by name or e-mail" className="max-w-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
      {!isLoading && clients.length === 0 ? <EmptyState>No clients found.</EmptyState> : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Name</TableHead><TableHead>E-mail</TableHead><TableHead>Cases</TableHead><TableHead>Status</TableHead><TableHead>Since</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" data-testid="client-row" data-email={c.email} onClick={() => navigate(`/app/clients/${c.id}`)}>
                  <TableCell className="font-medium">{c.name || '—'}</TableCell>
                  <TableCell>{c.email}</TableCell>
                  <TableCell>{c.cases}</TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell className="text-sm">{formatDate(c.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PageContainer>
  );
}
