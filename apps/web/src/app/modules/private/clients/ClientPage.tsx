import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft, Flag, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageContainer, StatusBadge, formatDate, humanize } from '@/components/app/page';
import { useAuth } from '@/lib/auth/AuthContext';
import { apiErrorMessage, useApiMutation, useApiQuery } from '@/lib/services/api';
import type { CaseSummary } from '../cases/types';

interface ClientDetail {
  id: string;
  email: string;
  name: string | null;
  status: string;
  createdAt: string;
  cases: CaseSummary[];
}

/** Flag a client for suspicious activity: starts the workflows subscribed to `client.flagged` (e.g. an investigation). */
function FlagDialog({ client, open, onOpenChange }: { client: ClientDetail; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: categories = [] } = useApiQuery<string[]>(['clients', 'flag-categories'], '/clients/flag-categories');
  const [category, setCategory] = useState('unusual_transactions');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const flag = useApiMutation<{ category: string; reason: string }, { investigationsOpened: number }>(
    ({ axios, url }, body) => axios.post(url(`/clients/${client.id}/flags`), body), [['clients'], ['cases']],
  );

  const submit = async () => {
    setError(null);
    try {
      const result = await flag.mutateAsync({ category, reason });
      toast.success(result.investigationsOpened ? 'Flag recorded — the compliance team has been alerted' : 'Flag recorded');
      setReason('');
      onOpenChange(false);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Flag suspicious activity</DialogTitle>
          <DialogDescription>The compliance team is alerted. The client is not told.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{humanize(c)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="flag-reason">What did you observe?</Label>
            <Textarea id="flag-reason" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={!reason.trim() || flag.isPending}>Submit flag</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface StartableWorkflow {
  id: string;
  name: string;
  version: number;
  inputs: Array<{ id: string; name: string; label?: string; type: string; required?: boolean }>;
}

const inputLabel = (input: { name: string; label?: string }) => input.label ?? humanize(input.name.replace(/([a-z])([A-Z])/g, '$1 $2'));

/** Assisted application: a member starts a case on a published workflow on behalf of the client. */
function StartCaseDialog({ client, open, onOpenChange }: { client: ClientDetail; open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const { data: workflows = [] } = useApiQuery<StartableWorkflow[]>(['workflows', 'startable'], '/workflows/startable', { enabled: open });
  const [workflowId, setWorkflowId] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  // The client's identity is known: no need to ask for it again.
  const inputs = useMemo(() => (workflows.find((w) => w.id === workflowId)?.inputs ?? []).filter((i) => !['email', 'fullName', 'name'].includes(i.name)), [workflows, workflowId]);
  const start = useApiMutation<Record<string, unknown>, { id: string; reference: string }>(({ axios, url }, body) => axios.post(url('/cases'), body), [['cases'], ['clients']]);

  const submit = async () => {
    setError(null);
    try {
      const data = Object.fromEntries(inputs.filter((i) => values[i.name] !== undefined && values[i.name] !== '')
        .map((i) => [i.name, i.type === 'number' ? Number(values[i.name]) : values[i.name]]));
      const kase = await start.mutateAsync({ workflowId, inputs: { fullName: client.name ?? client.email, ...data }, client: { email: client.email, name: client.name ?? undefined } });
      toast.success(`Application ${kase.reference} prepared — ${client.name || client.email} was asked to review and confirm it`);
      onOpenChange(false);
      navigate(`/app/cases/${kase.id}`);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start an application</DialogTitle>
          <DialogDescription>On behalf of {client.name || client.email}, who confirms it in their portal before it is processed. Someone else decides it (segregation of duties).</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Workflow</Label>
            <Select value={workflowId} onValueChange={setWorkflowId}>
              <SelectTrigger aria-label="Workflow"><SelectValue placeholder="Choose a published workflow" /></SelectTrigger>
              <SelectContent>{workflows.map((w) => <SelectItem key={w.id} value={w.id}>{w.name} (v{w.version})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {inputs.map((input) => (
            <div key={input.id} className="space-y-2">
              <Label htmlFor={`input-${input.name}`}>{inputLabel(input)}{input.required ? '' : ' (optional)'}</Label>
              <Input id={`input-${input.name}`} type={input.type === 'number' ? 'number' : 'text'} value={values[input.name] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [input.name]: e.target.value }))} />
            </div>
          ))}
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!workflowId || start.isPending || inputs.some((i) => i.required && !values[i.name])}>Start application</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ClientPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { data: client, error, isLoading } = useApiQuery<ClientDetail>(['clients', 'detail', clientId], `/clients/${clientId}`);
  const [flagOpen, setFlagOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);

  if (isLoading) return <PageContainer>Loading…</PageContainer>;
  if (error || !client) return <PageContainer><Alert variant="destructive"><AlertDescription>{apiErrorMessage(error)}</AlertDescription></Alert></PageContainer>;

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" onClick={() => navigate('/app/clients')}><ArrowLeft className="h-4 w-4 mr-2" />Back to clients</Button>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{client.name || client.email}</h1>
          <p className="text-muted-foreground">{client.email} · client since {formatDate(client.createdAt)} · <StatusBadge status={client.status} /></p>
        </div>
        <div className="flex gap-2">
          {hasPermission('cases:create') && <Button variant="outline" onClick={() => setStartOpen(true)}><Plus className="h-4 w-4 mr-2" />Start application</Button>}
          {hasPermission('clients:update') && <Button variant="destructive" onClick={() => setFlagOpen(true)}><Flag className="h-4 w-4 mr-2" />Flag suspicious activity</Button>}
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Cases</CardTitle>
          <CardDescription>Cases of this client that you can see</CardDescription>
        </CardHeader>
        <CardContent>
          {client.cases.length === 0 ? <p className="text-sm text-muted-foreground">No cases in your scope.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Title</TableHead><TableHead>Status</TableHead><TableHead>Opened</TableHead></TableRow></TableHeader>
              <TableBody>
                {client.cases.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" data-testid="case-row" data-case-reference={c.reference} onClick={() => navigate(`/app/cases/${c.id}`)}>
                    <TableCell className="font-mono text-xs">{c.reference}</TableCell>
                    <TableCell>{c.title}</TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell className="text-sm">{formatDate(c.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <FlagDialog client={client} open={flagOpen} onOpenChange={setFlagOpen} />
      {startOpen && <StartCaseDialog client={client} open={startOpen} onOpenChange={setStartOpen} />}
    </PageContainer>
  );
}
