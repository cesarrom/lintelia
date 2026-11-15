import { useState } from 'react';
import { toast } from 'sonner';
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

  return (
    <Card data-testid="client-request" data-status={request.status}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{request.title}</CardTitle>
            {request.case && <CardDescription>About {request.case.title} ({request.case.reference})</CardDescription>}
          </div>
          <StatusBadge status={open ? 'waiting_for_you' : request.status} label={open ? 'Waiting for you' : request.status === 'completed' ? 'Answered' : undefined} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {request.description && <p className="text-sm whitespace-pre-wrap" data-testid="request-description">{request.description}</p>}
        {request.dueAt && open && <p className="text-xs text-muted-foreground">Please answer by {formatDate(request.dueAt)}</p>}
        {open && request.action && <ClientAction action={request.action} />}
        {open && !request.action && request.items[0]?.type === 'parties' && (caseId ?? request.case?.id) && (
          <PartiesRequest caseId={(caseId ?? request.case?.id)!} roles={(request.items[0] as { roles?: string[] }).roles ?? []} />
        )}
        {open && !request.action && request.items[0]?.type === 'form' && <FormRequest taskId={request.id} respondPath={respondPath} />}
        {open && !request.action && request.items[0]?.type !== 'parties' && request.items[0]?.type !== 'form' && (
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
            <Button onClick={submit} disabled={respond.isPending || request.items.some((i) => { const v = values[i.key]; return Array.isArray(v) ? !v.length : !v?.trim(); })}>Send answer</Button>
          </>
        )}
        {!open && request.answeredAt && <p className="text-sm text-muted-foreground">Answered on {formatDate(request.answeredAt)}</p>}
      </CardContent>
    </Card>
  );
}
