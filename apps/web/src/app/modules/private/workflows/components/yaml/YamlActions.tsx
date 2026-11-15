import React from 'react';
import { Button } from '@/components/ui/button';
import { useWorkflow } from '../WorkflowContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { validateWorkflowYaml, yamlToWorkflow } from '@repo/fintivio/utilities';

export function YamlActions() {
  const { loadWorkflow, yaml } = useWorkflow();
  const [yamlDialogOpen, setYamlDialogOpen] = useState(false);
  const [yamlContent, setYamlContent] = useState(yaml);
  const [error, setError] = useState<string | null>(null);

  const handleExportYaml = () => {
    setYamlContent(yaml);
    setYamlDialogOpen(true);
  };

  const handleImportYaml = () => {
    setYamlContent('');
    setError(null);
    setYamlDialogOpen(true);
  };

  const handleApplyYaml = () => {
    try {
      if (!validateWorkflowYaml(yamlContent)) {
        setError('Invalid YAML format or schema');
        return;
      }

      yamlToWorkflow(yamlContent);
      loadWorkflow(yamlContent);
      setYamlDialogOpen(false);
      setError(null);
    } catch (err) {
      setError('Failed to parse YAML: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <Button variant="outline" onClick={handleExportYaml} title="Export YAML">
          <Download className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={handleImportYaml} title="Import YAML">
          <Upload className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={yamlDialogOpen} onOpenChange={setYamlDialogOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Workflow YAML</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Textarea
              value={yamlContent}
              onChange={(e) => setYamlContent(e.target.value)}
              className="font-mono h-[400px]"
              placeholder="Paste your workflow YAML here..."
            />
            {error && (
              <div className="text-red-500 text-sm">{error}</div>
            )}
            <Button onClick={handleApplyYaml}>
              Apply YAML
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 