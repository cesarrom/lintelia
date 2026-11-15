'use client';

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MoreHorizontal, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { RunWorkflowDialog } from "./components/RunWorkflowDialog";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { useSession } from "@descope/react-sdk";
import { Link } from "@/components/ui/link";
import { useWorkflowList, useWorkflowLoad, useWorkflowSetStatus, useWorkflowStart } from "@/lib/services/workflow.hooks";
import { useTenant } from "@/lib/providers/TenantProvider";

interface StatusChangeConfirmation {
  workflowId: string;
  workflowName: string;
  fromStatus: 'draft' | 'active' | 'archived';
  toStatus: 'draft' | 'active' | 'archived';
}

export default function WorkflowsPage() {
  const session = useSession();
  const { domain } = useTenant();
  const [runWorkflowId, setRunWorkflowId] = useState<string | null>(null);

  const { data: workflows = [], refetch } = useWorkflowList();
  const { data: runningWorkflowRef } = useWorkflowLoad({ workflowId: runWorkflowId! }, { enabled: !!runWorkflowId });

  const { mutateAsync: run } = useWorkflowStart();
  const { mutateAsync: setStatus } = useWorkflowSetStatus();

  const runningWorkflow = runWorkflowId ? runningWorkflowRef : undefined;

  const [statusChange, setStatusChange] = useState<StatusChangeConfirmation | null>(null);
  const handleStatusChange = async (workflowId: string, status: 'draft' | 'active' | 'archived') => {
    const workflow = workflows.find(w => w.id === workflowId);
    if (!workflow) return;

    setStatusChange({
      workflowId,
      workflowName: workflow.name,
      fromStatus: workflow.status!,
      toStatus: status,
    });
  };

  const handleConfirmStatusChange = async () => {
    if (!statusChange) return;
    await setStatus({
      workflowId: statusChange.workflowId,
      status: statusChange.toStatus
    });
    refetch();
  };

  const getStatusChangeMessage = (fromStatus: string, toStatus: string) => {
    if (fromStatus === 'draft' && toStatus === 'active') {
      return 'Activating this workflow will make it available for execution. Are you sure you want to continue?';
    }
    if (fromStatus === 'active' && toStatus === 'archived') {
      return 'Archiving this workflow will stop all its triggers and prevent future executions. Are you sure you want to continue?';
    }
    if (fromStatus === 'archived' && toStatus === 'draft') {
      return 'Restoring this workflow will allow you to edit it again. Are you sure you want to continue?';
    }
    return 'Are you sure you want to change the status of this workflow?';
  };

  const getStatusChangeTitle = (fromStatus: string, toStatus: string) => {
    if (fromStatus === 'draft' && toStatus === 'active') return 'Activate Workflow';
    if (fromStatus === 'active' && toStatus === 'archived') return 'Archive Workflow';
    if (fromStatus === 'archived' && toStatus === 'draft') return 'Restore Workflow';
    return 'Change Workflow Status';
  };

  const handleRunWorkflow = async (workflowId: string) => {
    setRunWorkflowId(workflowId);
  };

  const handleRunWorkflowWithInputs = async (inputs: Record<string, unknown>) => {
    if (!runningWorkflow) return;
    await run({ variables: inputs, yaml: runningWorkflow.yaml, token: session.sessionToken, domain, workflowId: runWorkflowId!, result: {} });
  };

  if (!domain) return null;

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Workflows</CardTitle>
              <CardDescription>
                Manage your workflow automations
              </CardDescription>
            </div>
            <Link href="/workflows/new" groups={['navigation', 'workflows']}>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Workflow
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center py-4">
            <Input
              placeholder="Filter workflows..."
              className="max-w-sm"
            />
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workflows.map((workflow) => (
                  <TableRow key={workflow.id}>
                    <TableCell className="font-medium">
                      {workflow.name}
                    </TableCell>
                    <TableCell>{workflow.description}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          workflow.status === "active"
                            ? "default"
                            : workflow.status === "draft"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {workflow.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{workflow.createdBy}</TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(workflow.createdAt!), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Link href={`/app/workflows/${workflow.id}`} groups={['navigation', 'workflows']} className="w-full h-full flex items-start justify-start">
                              <span className="text-start">Edit</span>
                            </Link>
                          </DropdownMenuItem>
                          {workflow.status === "active" && (
                            <DropdownMenuItem
                              onClick={() => handleRunWorkflow(workflow.id!)}
                            >
                              Run
                            </DropdownMenuItem>
                          )}
                          {workflow.status === "draft" && (
                            <DropdownMenuItem
                              onClick={() =>
                                handleStatusChange(workflow.id!, "active")
                              }
                            >
                              Activate
                            </DropdownMenuItem>
                          )}
                          {workflow.status === "active" && (
                            <DropdownMenuItem
                              onClick={() =>
                                handleStatusChange(workflow.id!, "archived")
                              }
                            >
                              Archive
                            </DropdownMenuItem>
                          )}
                          {workflow.status === "archived" && (
                            <DropdownMenuItem
                              onClick={() =>
                                handleStatusChange(workflow.id!, "draft")
                              }
                            >
                              Restore to Draft
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {runningWorkflow && runningWorkflow.yaml && (
        <RunWorkflowDialog
          open={!!runningWorkflow}
          onOpenChange={(open) => !open && setRunWorkflowId(null)}
          workflowId={runningWorkflow?.id || ''}
          yaml={runningWorkflow?.yaml || ''}
          onRun={handleRunWorkflowWithInputs}
        />
      )}

      {statusChange && (
        <ConfirmDialog
          open={!!statusChange}
          onOpenChange={(open) => !open && setStatusChange(null)}
          title={getStatusChangeTitle(statusChange.fromStatus, statusChange.toStatus)}
          description={getStatusChangeMessage(statusChange.fromStatus, statusChange.toStatus)}
          onConfirm={handleConfirmStatusChange}
        />
      )}
    </div>
  );
}
