import { type ObjectContext, type VirtualObjectDefinition } from '@restatedev/restate-sdk/fetch';
import { z } from 'zod';
import { type NodeData } from './(components)/yaml/types';

export const workflowNodeDataSchema = z.object({
  workflowId: z.string(),
  inputMap: z.record(z.string(), z.string())
});

export type WorkflowNodeData = z.infer<typeof workflowNodeDataSchema>;

export const events = {
  done: 'started'
} as const;

export type WorkflowEvent = (typeof events)[keyof typeof events];

export type ExecuteNodeFunctionProps = { executionId: string, nodeData: NodeData, yaml: string, domain: string, token: string, result: Record<string, unknown> }

export type ExecuteNodeFunction = (c: ObjectContext, props: ExecuteNodeFunctionProps) => Promise<Record<string, unknown>>;

export type ExecutableNode = VirtualObjectDefinition<string, {
  executeNode: ExecuteNodeFunction;
}>;