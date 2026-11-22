import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft, BellRing, Check, ClipboardCheck, Flag } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { KeyValues, StatusBadge, formatDate } from '@/components/app/page';
import { useAuth } from '@/lib/auth/AuthContext';
import { apiErrorMessage, useApiMutation, useApiQuery } from '@/lib/services/api';
import { RequestCard, type ClientRequest } from './RequestCard';
import { clientProgress, clientStatus } from './PortalHomePage';

interface MyCaseDetail {
  id: string;
  reference: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  steps: Array<{ name: string; status: 'done' | 'in_progress' | 'waiting_for_you' }>;
  requests: ClientRequest[];
  answers: Record<string, unknown>;
  consents: Array<{ document: string; version: string; acceptedAt: string }>;
  confirmation: { id: string; title: string; description: string | null } | null;
}

/** An application prepared by an adviser: the client checks it and confirms (with consent) before it is processed. */
function ConfirmApplication({ kase }: { kase: MyCaseDetail }) {
  const { tenant } = useAuth();
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = useApiMutation<void>(({ axios, url }) => axios.post(url(`/me/cases/${kase.id}/confirm`), { consent: true }), [['portal']]);

  const submit = async () => {
    setError(null);
    try {
      await confirm.mutateAsync();
      toast.success('Thank you — your application was submitted');
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  return (
    <Card data-testid="confirm-application" className="overflow-hidden border-primary/40 shadow-raised">
      <div className="flex items-center gap-3 border-b bg-primary-soft/70 px-5 py-3.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><ClipboardCheck className="h-4 w-4" /></span>
        <div>
          <CardTitle className="text-base">{kase.confirmation!.title}</CardTitle>
          <p className="text-xs text-muted-foreground">Prepared by your adviser — please check and confirm</p>
        </div>
      </div>
      <CardContent className="space-y-4 pt-5">
        {kase.confirmation!.description && <p className="text-sm">{kase.confirmation!.description}</p>}
        <KeyValues data={kase.answers} />
        <label className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
          <Checkbox aria-label="I confirm and consent" checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
          <span>I confirm these details are correct and agree that {tenant?.name ?? 'the institution'} processes them to handle my application.</span>
        </label>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <Button onClick={submit} disabled={!consent || confirm.isPending} className="w-full sm:w-auto">Confirm and submit</Button>
      </CardContent>
    </Card>
  );
}

/** The stages of an application as the client sees them: received, the visible steps, the decision. */
function Progress({ kase }: { kase: MyCaseDetail }) {
  const decided = ['approved', 'rejected', 'closed'].includes(kase.status);
  const items: Array<{ label: string; state: 'done' | 'current' | 'waiting' | 'todo'; testId?: string; note?: string }> = [
    { label: 'Application received', state: 'done', note: formatDate(kase.createdAt) },
    ...kase.steps.map((step) => ({
      label: step.name,
      state: step.status === 'done' ? 'done' as const : step.status === 'waiting_for_you' ? 'waiting' as const : 'current' as const,
      testId: 'portal-step',
      note: step.status === 'done' ? 'completed' : step.status === 'waiting_for_you' ? 'waiting for you' : 'in progress',
    })),
    { label: decided ? `Decision: ${clientStatus(kase.status)}` : 'Decision', state: decided ? 'done' : 'todo', note: decided ? formatDate(kase.updatedAt) : 'we will e-mail you' },
  ];
  return (
    <ol className="relative">
      {items.map((item, i) => (
        <li key={i} className="relative flex gap-3.5 pb-6 last:pb-0" data-testid={item.testId}>
          {i < items.length - 1 && <span aria-hidden="true" className={cn('absolute left-[13px] top-7 h-[calc(100%-24px)] w-0.5 rounded-full', item.state === 'done' ? 'bg-primary/70' : 'bg-border')} />}
          <span className={cn(
            'relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2',
            item.state === 'done' && 'border-primary bg-primary text-primary-foreground',
            item.state === 'current' && 'border-primary bg-background text-primary',
            item.state === 'waiting' && 'border-warning bg-warning text-white',
            item.state === 'todo' && 'border-border bg-background text-muted-foreground',
          )}>
            {item.state === 'done' ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : item.state === 'waiting' ? <BellRing className="h-3.5 w-3.5" /> : item.state === 'current' ? <span className="h-2 w-2 rounded-full bg-primary" /> : <Flag className="h-3 w-3" />}
          </span>
          <div className="min-w-0 pt-0.5">
            <p className={cn('text-sm font-medium leading-snug', item.state === 'todo' && 'text-muted-foreground')}>{item.label}</p>
            {item.note && <p className="text-xs text-muted-foreground">{item.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** One application: where it stands and what the institution needs from me. No internal details are shown. */
export default function PortalCasePage() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const { data: kase, error, isLoading } = useApiQuery<MyCaseDetail>(['portal', 'case', caseId], `/me/cases/${caseId}`, { refetchInterval: 4000 });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-40" /><Skeleton className="h-32 w-full rounded-2xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div>;
  if (error || !kase) return <Alert variant="destructive"><AlertDescription>{apiErrorMessage(error)}</AlertDescription></Alert>;
  const open = kase.requests.filter((r) => r.status === 'open').length;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => navigate('/portal')}><ArrowLeft className="h-4 w-4" />My applications</Button>
      <div className="rounded-2xl border bg-card p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-xs tracking-wide text-muted-foreground">{kase.reference}</p>
            <h1 className="mt-1 text-[24px] font-semibold leading-tight tracking-[-0.02em]">{kase.title}</h1>
            <p className="mt-2.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span data-testid="portal-case-status"><StatusBadge status={kase.status} label={clientStatus(kase.status)} /></span>
              <span>· last update {formatDate(kase.updatedAt)}</span>
            </p>
          </div>
          {open > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-3 py-1 text-[13px] font-medium text-[hsl(30_85%_34%)] ring-1 ring-inset ring-warning/25"><BellRing className="h-3.5 w-3.5" />{open} {open === 1 ? 'request needs' : 'requests need'} your answer</span>}
        </div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted">
          <span className="block h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${clientProgress(kase.status)}%` }} />
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          {kase.confirmation && <ConfirmApplication kase={kase} />}
          {kase.requests.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-[15px] font-semibold tracking-tight">Requests</h2>
              {kase.requests.map((r) => <RequestCard key={r.id} request={r} caseId={kase.id} respondPath={`/me/cases/${kase.id}/requests/${r.id}/respond`} />)}
            </section>
          )}
          {!kase.confirmation && (
            <Card>
              <CardHeader><CardTitle className="text-base">Your application details</CardTitle></CardHeader>
              <CardContent><KeyValues data={kase.answers} /></CardContent>
            </Card>
          )}
        </div>
        <Card className="lg:sticky lg:top-24">
          <CardHeader className="pb-4"><CardTitle className="text-base">Progress</CardTitle></CardHeader>
          <CardContent><Progress kase={kase} /></CardContent>
        </Card>
      </div>
    </div>
  );
}
