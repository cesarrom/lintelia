'use client';

import { load } from '@/components/workflow/server/load';
import { save } from '@/components/workflow/server/save';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

const WorkflowEditor = dynamic(
  () => import('@/components/workflow/WorkflowEditor'),
  { ssr: false }
);

export default function ExistingWorkflowPage() {
  const { workflow_id } = useParams<{ workflow_id: string }>();
  const [, startTransition] = useTransition();
  const [state, setState] = useState<{
    yaml: string | null;
  }>({
    yaml: null,
  });

  useEffect(() => {
    startTransition(async () => {
      const { yaml } = await load({ workflowId: workflow_id });
      setState({ yaml });
    });
  }, [workflow_id])

  const handleSave = async (yaml: string) => {
    startTransition(async () => {
      const { yaml: savedYaml } = await save({
        workflowId: workflow_id,
        yaml,
      });

      setState({ yaml: savedYaml });
    });
  }

  if (!state.yaml) {
    return <div>Loading...</div>;
  }

  return <WorkflowEditor key={workflow_id} onSave={handleSave} initialYaml={state.yaml} />;
}