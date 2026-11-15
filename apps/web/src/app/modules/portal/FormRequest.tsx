import { useState } from 'react';
import { toast } from 'sonner';
import type { FormConfig } from '@repo/fintivio/schemas';
import { FormViewer } from '@/app/modules/private/forms/components/form-builder';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiErrorMessage, useApiMutation, useApiQuery } from '@/lib/services/api';

/** A form the institution sent to this person (`form.request`, docs/plans/06): filled and sent from the portal. */
export function FormRequest({ taskId, respondPath }: { taskId: string; respondPath: string }) {
  const { data: form, error: loadError } = useApiQuery<{ id: string; name: string; config: FormConfig }>(['portal', 'request-form', taskId], `/me/requests/${taskId}/form`);
  const [error, setError] = useState<string | null>(null);
  const respond = useApiMutation<Record<string, unknown>>(({ axios, url }, answers) => axios.post(url(respondPath), { response: { form: answers } }), [['portal']]);
  if (loadError) return <Alert variant="destructive"><AlertDescription>{apiErrorMessage(loadError)}</AlertDescription></Alert>;
  if (!form) return <p className="text-sm text-muted-foreground">Loading the form…</p>;
  return (
    <div className="space-y-3" data-testid="form-request">
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <fieldset disabled={respond.isPending}>
        <FormViewer config={form.config} onSubmit={async (answers: Record<string, unknown>) => {
          setError(null);
          try {
            await respond.mutateAsync(answers);
            toast.success('Thank you — your answers were sent');
          } catch (e) {
            setError(apiErrorMessage(e));
          }
        }} />
      </fieldset>
    </div>
  );
}
