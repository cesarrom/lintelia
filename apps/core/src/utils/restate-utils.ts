import { NodeData } from "@repo/fintivio";
import { type ObjectContext, type VirtualObjectDefinition } from '@restatedev/restate-sdk/fetch';
import * as restate from "@restatedev/restate-sdk/fetch";

export const serveRestate = (endpoint: ReturnType<typeof restate.endpoint>) => {
  const { fetch } = endpoint.handler();
  return {
    POST: (req: Request) => {
      return fetch(req);
    },
    GET: (req: Request) => {
      return fetch(req);
    },
  };
};



export type ExecuteNodeFunctionProps = { executionId: string, nodeData: NodeData, yaml: string, domain: string, token: string, result: Record<string, unknown>, resumableId?: string, resumableResult?: Record<string, unknown>, sourceEvent: string, workflowId: string }

export type ExecuteNodeFunction = (c: ObjectContext, props: ExecuteNodeFunctionProps) => Promise<Record<string, unknown>>;

export type ExecutableNode = VirtualObjectDefinition<string, {
  executeNode: ExecuteNodeFunction;
}>;