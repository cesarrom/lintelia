import { useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, CheckCircle2, ClipboardList, MessageSquareText, ShieldCheck, Upload, UsersRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { StatusBadge, formatDate } from '@/components/app/page';
import { apiErrorMessage, useApiMutation } from '@/lib/services/api';
import { RequestFileUploader } from '@/components/app/files';
import { ClientAction, type ClientActionView } from './ClientAction';
import { PartiesRequest } from './PartiesRequest';
import { FormRequest } from './FormRequest';

export interface ClientRequest {
  id: string;
  /** `screen`: a screen of a client-app journey, continued in the app. */
  kind?: string;
  title: string;
  description: string | null;
  status: string;
  items: Array<{ key: string; label: string; type: string }>;
  /** A connector step the client completes on the vendor's page (identity verification, signature). */
  action?: ClientActionView | null;
  dueAt: string | null;
  answeredAt: string | null;
  case?: { id: string; reference: string; title: string } | null;
}

/** A request from the institution; open ones can be answered here. */
export function RequestCard({ request, respondPath, caseId }: { request: ClientRequest; respondPath: string; caseId?: string }) {
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const respond = useApiMutation<Record<string, string | string[]>>(({ axios, url }, response) => axios.post(url(respondPath), { response }), [['portal']]);
  const open = request.status === 'open';

  const submit = async () => {
    setError(null);
    try {
      await respond.mutateAsync(values);
      toast.success('Thank you — your answer was sent');
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const kind = request.action ? 'action' : request.items[0]?.type ?? 'text';
  const Icon = kind === 'action' ? ShieldCheck : kind === 'file' ? Upload : kind === 'parties' ? UsersRound : kind === 'form' ? ClipboardList : MessageSquareText;
  return (
    <Card data-testid="client-request" data-status={request.status} className={cn('overflow-hidden', open && 'border-warning/40 shadow-raised')}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', open ? 'bg-warning-soft text-[hsl(30_85%_38%)]' : 'bg-muted text-muted-foreground')}><Icon className="h-[18px] w-[18px]" /></span>
            <div className="min-w-0">
              <CardTitle className="text-base">{request.title}</CardTitle>
              {request.case && <CardDescription>About {request.case.title} ({request.case.reference})</CardDescription>}
            </div>
          </div>
          <StatusBadge status={open ? 'waiting_for_you' : request.status} label={open ? 'Waiting for you' : request.status === 'completed' ? 'Answered' : undefined} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {request.description && <p className="whitespace-pre-wrap text-sm leading-relaxed" data-testid="request-description">{request.description}</p>}
        {request.dueAt && open && <p className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-1 text-xs text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" />Please answer by {formatDate(request.dueAt)}</p>}
        {open && request.kind === 'screen' && (caseId ?? request.case?.id) && (
          <Button asChild><a href={`/portal/journeys/${caseId ?? request.case?.id}`}>Continue</a></Button>
        )}
        {/* The request's description usually is the action's instructions: say it once. */}
        {open && request.action && <ClientAction action={request.action.instructions === request.description ? { ...request.action, instructions: null } : request.action} />}
        {open && !request.action && request.items[0]?.type === 'parties' && (caseId ?? request.case?.id) && (
          <PartiesRequest caseId={(caseId ?? request.case?.id)!} roles={(request.items[0] as { roles?: string[] }).roles ?? []} />
        )}
        {open && !request.action && request.items[0]?.type === 'form' && <FormRequest taskId={request.id} respondPath={respondPath} />}
        {open && !request.action && request.kind !== 'screen' && request.items[0]?.type !== 'parties' && request.items[0]?.type !== 'form' && (
          <>
            {request.items.map((item) => (
              <div key={item.key} className="space-y-2">
                <Label htmlFor={`${request.id}-${item.key}`}>{request.items.length === 1 && item.type !== 'file' ? "Your answer" : item.label}</Label>
                {item.type === 'file'
                  ? <RequestFileUploader taskId={request.id} itemKey={item.key} label={item.label} onChange={(ids) => setValues((v) => ({ ...v, [item.key]: ids }))} />
                  : <Textarea id={`${request.id}-${item.key}`} rows={4} value={(values[item.key] as string) ?? ''} onChange={(e) => setValues((v) => ({ ...v, [item.key]: e.target.value }))} />}
              </div>
            ))}
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <Button onClick={submit} className="w-full sm:w-auto" disabled={respond.isPending || request.items.some((i) => { const v = values[i.key]; return Array.isArray(v) ? !v.length : !v?.trim(); })}>Send answer</Button>
          </>
        )}
        {!open && request.answeredAt && <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-success" />Answered on {formatDate(request.answeredAt)}</p>}
      </CardContent>
    </Card>
  );
}
