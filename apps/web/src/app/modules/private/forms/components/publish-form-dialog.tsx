import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';
import type { Form } from '@repo/fintivio/schemas';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiErrorMessage, useApiMutation, useApiQuery } from '@/lib/services/api';

interface Publication {
  published: boolean;
  publicKey?: string;
  allowedOrigins?: string[];
  workflowId?: string;
  embed?: { url: string; script: string; iframe: string };
}

function Snippet({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(value).then(() => toast.success('Copied'))}><Copy className="h-3 w-3 mr-1" />Copy</Button>
      </div>
      <pre className="whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs" data-testid={testId}>{value}</pre>
    </div>
  );
}

/**
 * Publish a form so it can be embedded on any site the institution lists: each submission (after the applicant
 * confirms their e-mail) opens a case on the chosen published workflow.
 */
export function PublishFormDialog({ form, open, onOpenChange }: { form: Form; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: publication } = useApiQuery<Publication>(['form', 'publication', form.id], `/forms/${form.id}/publication`, { enabled: open });
  const { data: workflows = [] } = useApiQuery<Array<{ id: string; name: string; activeVersion: number | null; startOn: string[] }>>(['workflows', 'list'], '/workflows', { enabled: open });
  const [workflowId, setWorkflowId] = useState('');
  const [origins, setOrigins] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (publication?.published) {
      setWorkflowId(publication.workflowId ?? '');
      setOrigins((publication.allowedOrigins ?? []).join('\n'));
    }
  }, [publication]);

  const publish = useApiMutation<void, Publication>(({ axios, url }) => axios.post(url(`/forms/${form.id}/publish`), {
    workflowId,
    allowedOrigins: origins.split(/[\s,]+/).map((o) => o.trim()).filter(Boolean),
  }), [['form']]);
  const unpublish = useApiMutation<void>(({ axios, url }) => axios.post(url(`/forms/${form.id}/unpublish`)), [['form']]);

  const onPublish = async () => {
    setError(null);
    try {
      await publish.mutateAsync();
      toast.success('Form published');
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const onUnpublish = async () => {
    try {
      await unpublish.mutateAsync();
      toast.success('Form unpublished — embedded copies stop accepting submissions');
      onOpenChange(false);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  const eligible = workflows.filter((w) => w.activeVersion && !w.startOn?.length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Publish “{form.name}”</DialogTitle>
          <DialogDescription>Embed the form on your website. Applicants confirm their e-mail, then a case opens on the workflow you choose.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Workflow that handles submissions</Label>
            <Select value={workflowId} onValueChange={setWorkflowId}>
              <SelectTrigger aria-label="Workflow"><SelectValue placeholder="Choose a published workflow" /></SelectTrigger>
              <SelectContent>{eligible.map((w) => <SelectItem key={w.id} value={w.id}>{w.name} (v{w.activeVersion})</SelectItem>)}</SelectContent>
            </Select>
            {eligible.length === 0 && <p className="text-xs text-muted-foreground">Publish a workflow first.</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="allowed-origins">Websites allowed to embed it (one per line)</Label>
            <Textarea id="allowed-origins" rows={3} placeholder="https://www.your-bank.com" value={origins} onChange={(e) => setOrigins(e.target.value)} />
            <p className="text-xs text-muted-foreground">Other sites cannot display or submit the form.</p>
          </div>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          {publication?.published && publication.embed && (
            <div className="space-y-3 rounded-md border p-3" data-testid="embed-snippets">
              <p className="text-sm font-medium">Published · key <span className="font-mono" data-testid="public-key">{publication.publicKey}</span></p>
              <Snippet label="Script (recommended)" value={publication.embed.script} testId="embed-script" />
              <Snippet label="iframe" value={publication.embed.iframe} testId="embed-iframe" />
              <Snippet label="Hosted page" value={publication.embed.url} testId="embed-url" />
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          {publication?.published && <Button variant="outline" onClick={onUnpublish} disabled={unpublish.isPending}>Unpublish</Button>}
          <Button onClick={onPublish} disabled={!workflowId || publish.isPending}>{publication?.published ? 'Update publication' : 'Publish'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
