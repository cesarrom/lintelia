'use client';

import dynamic from 'next/dynamic';
import { load, save } from '../../../(actions)';
import { useParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const WorkflowEditor = dynamic(
  () => import('../../../(components)/WorkflowEditor'),
  { ssr: false }
);

export default function ExistingWorkflowPage() {
  const { workflow_id } = useParams<{ workflow_id: string }>();
  const [, startTransition] = useTransition();
  const [state, setState] = useState<{
    yaml: string | null;
    error: string | null;
  }>({
    yaml: null,
    error: null,
  });

  useEffect(() => {
    startTransition(async () => {
      try {
        const { yaml } = await load(workflow_id);
        setState({ yaml, error: null });
      } catch (error) {
        setState({ yaml: null, error: error instanceof Error ? error.message : 'Failed to load workflow' });
      }
    });
  }, [workflow_id]);

  const handleSave = async (yaml: string) => {
    try {
      const { yaml: savedYaml } = await save({
        workflowId: workflow_id,
        yaml,
      });
      setState({ yaml: savedYaml, error: null });
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to save workflow' 
      }));
    }
  };

  if (state.error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-destructive">{state.error}</div>
      </div>
    );
  }

  if (!state.yaml) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-8 w-[200px]" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  return (
    <WorkflowEditor 
      key={workflow_id} 
      initialYaml={state.yaml} 
      onSave={handleSave} 
    />
  );
}