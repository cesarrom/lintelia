'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import WorkflowEditor from './components/WorkflowEditor';
import { useParams } from 'react-router';
import { useWorkflowLoad, useWorkflowSave } from '@/lib/services/workflow.hooks';

export default function ExistingWorkflowPage() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const { data: workflow, refetch, error: fetchError } = useWorkflowLoad({ workflowId: workflowId! });
  console.log({workflow, workflowId});
  const { mutate: save, error: saveError } = useWorkflowSave();
  const error = fetchError || saveError;
  const state = useMemo(() => ({
    yaml: workflow?.yaml,
    error: error?.message,
  }), [workflow, error])

  const handleSave = async (yaml: string) => {
    save({
      workflowId: workflowId!,
      yaml,
    });
    refetch();
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
      key={workflowId}
      initialYaml={state.yaml}
      onSave={handleSave}
    />
  );
}