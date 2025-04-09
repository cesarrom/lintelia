import { type ObjectContext, type VirtualObjectDefinition } from '@restatedev/restate-sdk/fetch';
import { type NodeData } from './(components)/yaml/types';

export type ExecuteNodeFunctionProps = { executionId: string, nodeData: NodeData, yaml: string, domain: string, token: string, result: Record<string, unknown>, resumableId?: string, resumableResult?: Record<string, unknown>, sourceEvent: string }

export type ExecuteNodeFunction = (c: ObjectContext, props: ExecuteNodeFunctionProps) => Promise<Record<string, unknown>>;

export type ExecutableNode = VirtualObjectDefinition<string, {
  executeNode: ExecuteNodeFunction;
}>;