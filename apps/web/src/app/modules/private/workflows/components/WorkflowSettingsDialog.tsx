import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { WorkflowSchema } from '@repo/fintivio/schemas';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AccessRuleEditor, type AccessRule } from '@/components/access/AccessRuleEditor';

type Stage = { key: string; label: string; clientLabel?: string };
type Settings = Pick<WorkflowSchema, 'function' | 'stages' | 'outputs' | 'caseTitle' | 'access'>;

const stageKey = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);

/**
 * Settings of the workflow as a whole (docs/plans/12): its business stages (case page, pipeline board, clients), whether
 * it is a function other workflows use as a step, and what it gives back to its caller.
 */
export function WorkflowSettingsDialog({ open, onOpenChange, workflow, onSave }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflow: Settings;
  onSave: (settings: Settings) => void;
}) {
  const [isFunction, setIsFunction] = useState(false);
  const [caseTitle, setCaseTitle] = useState('');
  const [stages, setStages] = useState<Stage[]>([]);
  const [outputs, setOutputs] = useState<Array<{ name: string; expression: string }>>([]);
  const [start, setStart] = useState<AccessRule | undefined>();
  const [cases, setCases] = useState<AccessRule | undefined>();
  useEffect(() => {
    if (!open) return;
    setStart(workflow.access?.start);
    setCases(workflow.access?.cases);
    setIsFunction(!!workflow.function);
    setCaseTitle(workflow.caseTitle ?? '');
    setStages(workflow.stages ?? []);
    setOutputs(Object.entries(workflow.outputs ?? {}).map(([name, expression]) => ({ name, expression })));
  }, [open, workflow]);

  const keys = stages.map((s) => s.key);
  const duplicate = keys.some((k, i) => k && keys.indexOf(k) !== i);
  const badOutput = outputs.some((o) => o.name && !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(o.name));
  const save = () => {
    onSave({
      function: isFunction || undefined,
      caseTitle: caseTitle.trim() || undefined,
      stages: stages.filter((s) => s.key && s.label).map((s) => ({ key: s.key, label: s.label, ...(s.clientLabel ? { clientLabel: s.clientLabel } : {}) })),
      outputs: Object.fromEntries(outputs.filter((o) => o.name && o.expression).map((o) => [o.name, o.expression])),
      access: start || cases ? { ...(start ? { start } : {}), ...(cases ? { cases } : {}) } : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Workflow settings</DialogTitle>
          <DialogDescription>How cases of this workflow are named and followed, and whether other workflows can use it as a step.</DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <div className="space-y-1.5">
            <Label htmlFor="wf-case-title">Case title</Label>
            <Input id="wf-case-title" value={caseTitle} onChange={(e) => setCaseTitle(e.target.value)} placeholder="e.g. Deal from {{applicant}} ({{input.vin}})" />
          </div>

          <section className="space-y-2" data-testid="wf-stages">
            <div>
              <h3 className="text-sm font-semibold">Stages</h3>
              <p className="text-xs text-muted-foreground">The business steps a case goes through. “Update the case” steps move it; the case page, the pipeline board and clients show them.</p>
            </div>
            {stages.map((stage, i) => (
              <div key={i} className="grid grid-cols-[1fr_10rem_auto] items-center gap-2">
                <Input aria-label="Stage label" placeholder="Label, e.g. Underwriting" value={stage.label}
                  onChange={(e) => setStages(stages.map((s, j) => (j === i ? { ...s, label: e.target.value, key: s.key && s.key !== stageKey(s.label) ? s.key : stageKey(e.target.value) } : s)))} />
                <Input aria-label="Stage key" className="font-mono text-xs" placeholder="key" value={stage.key}
                  onChange={(e) => setStages(stages.map((s, j) => (j === i ? { ...s, key: stageKey(e.target.value) } : s)))} />
                <Button type="button" variant="ghost" size="icon" aria-label="Remove the stage" onClick={() => setStages(stages.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            {duplicate && <p className="text-xs text-destructive">Each stage needs its own key.</p>}
            <Button type="button" variant="outline" size="sm" onClick={() => setStages([...stages, { key: '', label: '' }])}><Plus className="h-4 w-4" />Add a stage</Button>
          </section>

          <section className="space-y-3" data-testid="wf-access">
            <div>
              <h3 className="text-sm font-semibold">Who may use it</h3>
              <p className="text-xs text-muted-foreground">Who may start it by hand, from a button or by API, and who may see its cases. It is an administrator's decision: publishing a change here waits for an administrator unless you are one.</p>
            </div>
            <AccessRuleEditor label="Who may start it" defaultLabel="Everyone who may start cases" value={start} onChange={setStart} testId="wf-access-start" />
            <AccessRuleEditor label="Who may see its cases" defaultLabel="Case scope (assigned, queued, started)" value={cases} onChange={setCases} testId="wf-access-cases" />
          </section>

          <section className="space-y-3 rounded-xl border p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor="wf-function" className="text-sm font-semibold">Function</Label>
                <p className="text-xs text-muted-foreground">Once published, other workflows find it in the palette under “Your functions” and use it as one step: its inputs are the step's fields, its outputs the step's result.</p>
              </div>
              <Switch id="wf-function" checked={isFunction} onCheckedChange={setIsFunction} data-testid="wf-function" />
            </div>
            <div className="space-y-2" data-testid="wf-outputs">
              <p className="text-xs font-medium text-muted-foreground">Outputs (what it gives back: name and expression, e.g. <code>= steps.pay.body.Id</code>)</p>
              {outputs.map((output, i) => (
                <div key={i} className="grid grid-cols-[10rem_1fr_auto] items-center gap-2">
                  <Input aria-label="Output name" className="font-mono text-xs" placeholder="name" value={output.name} onChange={(e) => setOutputs(outputs.map((o, j) => (j === i ? { ...o, name: e.target.value } : o)))} />
                  <Input aria-label="Output expression" className="font-mono text-xs" placeholder="= steps.step.value" value={output.expression} onChange={(e) => setOutputs(outputs.map((o, j) => (j === i ? { ...o, expression: e.target.value } : o)))} />
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove the output" onClick={() => setOutputs(outputs.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              {badOutput && <p className="text-xs text-destructive">Output names are letters, digits and _.</p>}
              <Button type="button" variant="outline" size="sm" onClick={() => setOutputs([...outputs, { name: '', expression: '' }])}><Plus className="h-4 w-4" />Add an output</Button>
            </div>
          </section>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={duplicate || badOutput} data-testid="wf-settings-save">Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
