import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface ClientActionView {
  type: 'redirect' | 'embed' | 'sdk';
  sdk: string | null;
  url: string;
  title: string | null;
  instructions: string | null;
}

/**
 * Messages the vendors' embedded pages send when the person finishes (Didit's web SDK protocol, Documenso's embed
 * events). They only update the screen: the decision always reaches us through the connector's signed webhook.
 */
const FINISHED = new Set(['didit:completed', 'didit:cancelled', 'document-completed', 'document-rejected']);

/**
 * A step a connector runs in the client's browser (identity verification, signature): opened in a dialog on the
 * vendor's own origin (camera allowed for liveness checks), or in a new tab when embedding is not possible.
 */
export function ClientAction({ action }: { action: ClientActionView }) {
  const [open, setOpen] = useState(false);
  const [finished, setFinished] = useState(false);
  const queryClient = useQueryClient();
  const origin = new URL(action.url).origin;

  useEffect(() => {
    if (!open) return;
    const listener = (event: MessageEvent) => {
      if (event.origin !== origin || !FINISHED.has(event.data?.type)) return;
      setFinished(true);
      setTimeout(() => {
        setOpen(false);
        void queryClient.invalidateQueries({ queryKey: ['portal'] });
      }, 1500);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [open, origin, queryClient]);

  const label = action.title ?? 'Continue';
  if (action.type === 'redirect') {
    return <Button asChild><a href={action.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-2" />{label}</a></Button>;
  }
  return (
    <>
      {action.instructions && <p className="text-sm text-muted-foreground">{action.instructions}</p>}
      {finished ? <p className="text-sm" data-testid="client-action-finished">Thank you. We are checking the result; this page updates by itself.</p> : (
        <Button onClick={() => setOpen(true)} data-testid="client-action"><ShieldCheck className="h-4 w-4 mr-2" />{label}</Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>Provided by our partner on their secure page.</DialogDescription>
          </DialogHeader>
          <iframe
            title={label} src={action.url} className="w-full h-[70vh] rounded-md border bg-white"
            allow="camera; microphone; fullscreen; clipboard-write"
            sandbox="allow-forms allow-scripts allow-same-origin allow-popups"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
