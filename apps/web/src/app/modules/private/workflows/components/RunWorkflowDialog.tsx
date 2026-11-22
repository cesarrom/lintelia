'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { yamlToWorkflow } from '@repo/lintelia/utilities';
import { WorkflowInputYaml } from '@repo/lintelia/schemas';

interface RunWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string;
  yaml: string;
  onRun: (inputs: Record<string, unknown>) => Promise<void>;
}

export function RunWorkflowDialog({
  open,
  onOpenChange,
  workflowId,
  yaml,
  onRun,
}: RunWorkflowDialogProps) {
  const [inputs, setInputs] = useState<Record<string, unknown>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse YAML to get workflow inputs
  const { workflow } = yamlToWorkflow(yaml);
  const workflowInputs = workflow.inputs || [];

  const handleInputChange = (input: WorkflowInputYaml, value: string) => {
    setInputs(prev => ({
      ...prev,
      [input.name]: value,
    }));
  };

  const handleRun = async () => {
    try {
      setIsRunning(true);
      setError(null);
      await onRun(inputs);
      onOpenChange(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to run workflow');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Run Workflow</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {workflowInputs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This workflow doesn't require any inputs.
            </p>
          ) : (
            <div className="space-y-4">
              {workflowInputs.map((input) => (
                <div key={input.id} className="space-y-2">
                  <Label>
                    {input.name}
                    {input.required && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    value={(inputs[input.name] as string) || ''}
                    onChange={(e) => handleInputChange(input, e.target.value)}
                    placeholder={input.description || `Enter ${input.name}`}
                  />
                  {input.description && (
                    <p className="text-xs text-muted-foreground">
                      {input.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRunning}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRun}
            disabled={isRunning || (workflowInputs.some(input => input.required && !inputs[input.name]))}
          >
            {isRunning ? 'Running...' : 'Run Workflow'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 