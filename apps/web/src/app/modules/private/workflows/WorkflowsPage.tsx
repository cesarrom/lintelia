import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { LayoutTemplate, MoreHorizontal, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, PageContainer, PageHeader, formatDate } from '@/components/app/page';
import { useAuth } from '@/lib/auth/AuthContext';
import { apiErrorDetails, apiErrorMessage, useApiMutation, useApiQuery } from '@/lib/services/api';
import { RunWorkflowDialog } from './components/RunWorkflowDialog';

interface WorkflowRow {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'archived';
  yaml: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  activeVersion: number | null;
  startOn: string[];
}

interface WorkflowTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
}

/** Ready-made workflows (loan pre-approval, suspicious activity...) to start from. */
function TemplateGallery({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const { data: templates = [] } = useApiQuery<WorkflowTemplate[]>(['workflow-templates'], '/workflow-templates', { enabled: open });
  const use = useApiMutation<string, { id: string }>(({ axios, url }, id) => axios.post(url(`/workflow-templates/${id}/use`)), [['workflows']]);

  const onUse = async (template: WorkflowTemplate) => {
    try {
      const workflow = await use.mutateAsync(template.id);
      toast.success(`Draft "${template.name}" created`);
      onOpenChange(false);
      navigate(`/app/workflows?created=${workflow.id}`);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Start from a template</DialogTitle>
          <DialogDescription>Templates are created as drafts: review them, adapt them, then publish.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id} className="flex flex-col" data-testid="workflow-template" data-template={t.id}>
              <CardHeader className="pb-2">
                <Badge variant="secondary" className="w-fit">{t.category}</Badge>
                <CardTitle className="text-base">{t.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-4">
                <p className="text-sm text-muted-foreground">{t.description}</p>
                <Button size="sm" onClick={() => onUse(t)} disabled={use.isPending}>Use template</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Workflows: drafts are edited freely; publishing validates the draft and freezes it as a new immutable version that
 * new cases use (running cases keep theirs).
 */
export default function WorkflowsPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { data: workflows = [], isLoading } = useApiQuery<WorkflowRow[]>(['workflows', 'list'], '/workflows');
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [publishErrors, setPublishErrors] = useState<{ name: string; errors: string[] } | null>(null);
  const [running, setRunning] = useState<WorkflowRow | null>(null);
  const publish = useApiMutation<string, { version: number }>(({ axios, url }, id) => axios.post(url(`/workflows/${id}/publish`)), [['workflows']]);
  const startCase = useApiMutation<{ id: string; inputs: Record<string, unknown> }, { caseId: string; reference: string }>(
    ({ axios, url }, { id, inputs }) => axios.post(url(`/workflows/${id}/executions`), { inputs }), [['cases']],
  );

  const onPublish = async (workflow: WorkflowRow) => {
    setPublishErrors(null);
    try {
      const result = await publish.mutateAsync(workflow.id);
      toast.success(`${workflow.name} published as version ${result.version}`);
    } catch (e) {
      const errors = apiErrorDetails(e);
      if (errors.length) setPublishErrors({ name: workflow.name, errors });
      else toast.error(apiErrorMessage(e));
    }
  };

  const onStart = async (inputs: Record<string, unknown>) => {
    if (!running) return;
    const kase = await startCase.mutateAsync({ id: running.id, inputs });
    toast.success(`Case ${kase.reference} opened`);
    navigate(`/app/cases/${kase.caseId}`);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Workflows"
        description="How cases are processed: automatic steps, reviews routed to roles, requests to clients and decisions"
        actions={hasPermission('workflows:manage') && (
          <>
            <Button variant="outline" onClick={() => setGalleryOpen(true)}><LayoutTemplate className="mr-2 h-4 w-4" />New from template</Button>
            <Button onClick={() => navigate('/app/workflows/new')}><Plus className="mr-2 h-4 w-4" />Blank workflow</Button>
          </>
        )}
      />

      {publishErrors && (
        <Alert variant="destructive" data-testid="publish-errors">
          <AlertTitle>{publishErrors.name} cannot be published yet</AlertTitle>
          <AlertDescription><ul className="list-disc pl-5">{publishErrors.errors.map((e) => <li key={e}>{e}</li>)}</ul></AlertDescription>
        </Alert>
      )}

      {!isLoading && workflows.length === 0 ? <EmptyState>No workflows yet. Start from a template.</EmptyState> : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Starts on</TableHead>
                <TableHead>Published</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {workflows.map((w) => (
                <TableRow key={w.id} data-testid="workflow-row" data-workflow-name={w.name}>
                  <TableCell>
                    <div className="font-medium">{w.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2 max-w-xl">{w.description}</div>
                  </TableCell>
                  <TableCell className="text-sm">{w.startOn?.length ? w.startOn.join(', ') : 'Form, API or manual'}</TableCell>
                  <TableCell data-testid="workflow-version">
                    {w.activeVersion ? <Badge>v{w.activeVersion}</Badge> : <Badge variant="secondary">Draft</Badge>}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{formatDate(w.updatedAt ?? w.createdAt)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" aria-label={`Actions for ${w.name}`}><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/app/workflows/${w.id}`)}>{hasPermission('workflows:manage') ? 'Edit' : 'View'}</DropdownMenuItem>
                        {hasPermission('workflows:publish') && <DropdownMenuItem onClick={() => onPublish(w)}>Publish</DropdownMenuItem>}
                        {hasPermission('cases:create') && w.activeVersion && !w.startOn?.length && (
                          <DropdownMenuItem onClick={() => setRunning(w)}>Start a case</DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TemplateGallery open={galleryOpen} onOpenChange={setGalleryOpen} />
      {running && (
        <RunWorkflowDialog open onOpenChange={(open) => !open && setRunning(null)} workflowId={running.id} yaml={running.yaml} onRun={onStart} />
      )}
    </PageContainer>
  );
}
