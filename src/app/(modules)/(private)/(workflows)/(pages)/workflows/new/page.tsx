'use client';

import { save } from '@/components/workflow/server/save';
import dynamic from 'next/dynamic';
import { redirect } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

const WorkflowEditor = dynamic(
  () => import('@/components/workflow/WorkflowEditor'),
  { ssr: false }
);

const DEFAULT_WORKFLOW_YAML = `
name: "Untitled Workflow"
description: ""
version: "1.0"
triggers: []
steps: []
`;

export default function NewWorkflowPage() {
  const [, startTransition] = useTransition();
  const [state, setState] = useState<{
    yaml: string;
    workflowId: string | null;
  }>({
    yaml: DEFAULT_WORKFLOW_YAML,
    workflowId: null,
  });

  const handleSave = async (yaml: string) => {
    startTransition(async () => {
      const { workflowId, yaml: savedYaml } = await save({
        yaml,
      });

      setState({
        yaml: savedYaml,
        workflowId,
      });
    });
  }

  useEffect(() => {
    if (state.workflowId) {
      redirect(`/workflows/${state.workflowId}`);
    }
  }, [state.workflowId])

  return <WorkflowEditor key="new" onSave={handleSave} initialYaml={state.yaml} />;
}