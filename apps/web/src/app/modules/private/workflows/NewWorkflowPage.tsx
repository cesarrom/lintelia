'use client';

import { useState } from 'react';

import WorkflowEditor from './components/WorkflowEditor';
import { useWorkflowSave } from '@/lib/services/workflow.hooks';
import { useNavigate } from 'react-router';

const DEFAULT_WORKFLOW_YAML = `
name: "Untitled Workflow"
description: ""
version: 1
triggers: []
steps: []
`;

export default function NewWorkflowPage() {
  const router = useNavigate();
  const { mutateAsync: save } = useWorkflowSave();
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (yaml: string) => {
    try {
      const { id: workflowId } = await save({ yaml });
      router(`/app/workflows/${workflowId}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save workflow');
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-destructive">{error}</div>
      </div>
    );
  }

  return (
    <WorkflowEditor 
      key="new" 
      initialYaml={DEFAULT_WORKFLOW_YAML} 
      onSave={handleSave} 
    />
  );
}