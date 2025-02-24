'use client';

import dynamic from 'next/dynamic';
import { save } from '../../../(actions)';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const WorkflowEditor = dynamic(
  () => import('../../../(components)/WorkflowEditor'),
  { ssr: false }
);

const DEFAULT_WORKFLOW_YAML = `
name: "Untitled Workflow"
description: ""
version: 1
triggers: []
steps: []
`;

export default function NewWorkflowPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (yaml: string) => {
    try {
      const { id: workflowId } = await save({ yaml });
      router.push(`/workflows/${workflowId}`);
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