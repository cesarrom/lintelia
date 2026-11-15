import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { KeyValues, StatusBadge, formatDate } from '@/components/app/page';
import { useAuth } from '@/lib/auth/AuthContext';
import { apiErrorMessage, useApiMutation, useApiQuery } from '@/lib/services/api';
import { RequestCard, type ClientRequest } from './RequestCard';
import { clientStatus } from './PortalHomePage';

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
    <Card data-testid="confirm-application" className="border-primary">
      <CardHeader><CardTitle className="text-base">{kase.confirmation!.title}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {kase.confirmation!.description && <p className="text-sm">{kase.confirmation!.description}</p>}
        <KeyValues data={kase.answers} />
        <label className="flex items-start gap-2 text-sm">
          <Checkbox aria-label="I confirm and consent" checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
          <span>I confirm these details are correct and agree that {tenant?.name ?? 'the institution'} processes them to handle my application.</span>
        </label>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <Button onClick={submit} disabled={!consent || confirm.isPending}>Confirm and submit</Button>
      </CardContent>
    </Card>
  );
}

/** One application: where it stands and what the institution needs from me. No internal details are shown. */
export default function PortalCasePage() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const { data: kase, error, isLoading } = useApiQuery<MyCaseDetail>(['portal', 'case', caseId], `/me/cases/${caseId}`, { refetchInterval: 4000 });

  if (isLoading) return <p>Loading…</p>;
  if (error || !kase) return <Alert variant="destructive"><AlertDescription>{apiErrorMessage(error)}</AlertDescription></Alert>;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/portal')}><ArrowLeft className="h-4 w-4 mr-2" />My applications</Button>
      <div>
        <p className="font-mono text-sm text-muted-foreground">{kase.reference}</p>
        <h1 className="text-2xl font-bold">{kase.title}</h1>
        <p className="mt-2 text-sm">Status: <span data-testid="portal-case-status"><StatusBadge status={kase.status} label={clientStatus(kase.status)} /></span> · last update {formatDate(kase.updatedAt)}</p>
      </div>
      {kase.confirmation && <ConfirmApplication kase={kase} />}
      {kase.requests.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Requests</h2>
          {kase.requests.map((r) => <RequestCard key={r.id} request={r} caseId={kase.id} respondPath={`/me/cases/${kase.id}/requests/${r.id}/respond`} />)}
        </section>
      )}
      {!kase.confirmation && (
        <Card>
          <CardHeader><CardTitle className="text-base">Your application details</CardTitle></CardHeader>
          <CardContent><KeyValues data={kase.answers} /></CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle className="text-base">Progress</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm">
            <li>✓ Application received</li>
            {kase.steps.map((s, i) => <li key={i} data-testid="portal-step">{s.status === 'done' ? '✓' : '…'} {s.name}{s.status === 'done' ? ' — completed' : s.status === 'waiting_for_you' ? ' — waiting for you' : ' — in progress'}</li>)}
            {['approved', 'rejected', 'closed'].includes(kase.status) && <li>✓ Decision: {clientStatus(kase.status)}</li>}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
