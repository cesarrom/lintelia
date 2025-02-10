import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";

interface RunWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string;
  onRun: (payload: Record<string, unknown>) => Promise<void>;
}

export function RunWorkflowDialog({
  open,
  onOpenChange,
  workflowId,
  onRun,
}: RunWorkflowDialogProps) {
  const [payload, setPayload] = useState('{\n  \n}');
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = async () => {
    try {
      setError(null);
      setIsRunning(true);
      
      // Parse the JSON payload
      const parsedPayload = JSON.parse(payload);
      
      // Run the workflow with the provided payload
      await onRun(parsedPayload);
      
      // Close the dialog on success
      onOpenChange(false);
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON format. Please check your input.');
      } else {
        setError('Failed to run workflow. Please try again.');
      }
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Run Workflow</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Input Payload (JSON)</Label>
            <Textarea
              value={payload}
              onChange={(e) => {
                setPayload(e.target.value);
                setError(null);
              }}
              placeholder="Enter the input payload as JSON"
              className="font-mono h-[200px]"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleRun} disabled={isRunning}>
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              'Run Workflow'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 