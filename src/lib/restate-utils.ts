import { yamlToWorkflow } from "@/app/(modules)/(private)/(workflows)/(components)/yaml/converter";
import { NodeData } from "@/app/(modules)/(private)/(workflows)/(components)/yaml/types";
import { ExecutableNode, ExecuteNodeFunctionProps } from "@/app/(modules)/(private)/(workflows)/types";
import * as restate from "@restatedev/restate-sdk/fetch";
import { set } from "lodash";
import Mustache from 'mustache';

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

export const getConfiguration = (ctx: restate.ObjectContext, executionId: string, config: Record<string, unknown>, result: Record<string, unknown> = {}): Record<string, unknown> => {
  // we want to walk the configuration and discover if there are entries like { [key: string]: "{{varPath}}" } we want to accumulate the "varPath"s into an array
  const jsonStr = JSON.stringify(config);
  const values = Mustache.render(jsonStr, result);
  const json = JSON.parse(values);

  // finally, we want to insert the values into the config
  return { ...config, ...json };
}

export const mergeResult = (ctx: Record<string, unknown>, newResult: Record<string, unknown>, nodeName: string, eventName: string) => {
  return set(ctx, [nodeName, eventName], newResult);
}

export const nextOrEndExecution = async (ctx: restate.ObjectContext, { nodeData, event, executionId, localResult, globalResult, yaml, domain, token }: { yaml: string, nodeData: NodeData, event: string, executionId: string, localResult: Record<string, unknown>, globalResult: Record<string, unknown>, domain: string, token: string }, opts?: { forceExecution?: string[] }) => {
  const result = mergeResult(globalResult, localResult, nodeData.name, event);

  // we evaluate if this node exports this particular event
  const exporting = nodeData.exports?.find(e => e.event === event);

  if (exporting) {
    const { outputs } = exporting;

    return getConfiguration(ctx, executionId, Object.fromEntries(outputs.map(o => [o.name, o.value] as const)), result);
  }

  const { nodes, edges } = yamlToWorkflow(yaml);

  const nodesById = nodes.reduce((acc, node) => {
    acc[node.id] = node;
    return acc;
  }, {} as Record<string, typeof nodes[number]>);
  const eventSourceHandleByType = `${nodeData.type}-${event}`;
  const eventSourceHandleByName = `${nodeData.name}-${event}`;
  const eventSourceHandleById = `${nodeData.id}-${event}`;
  const eventSources = [eventSourceHandleByType, eventSourceHandleByName, eventSourceHandleById];
  const nextNodes = edges.filter((edge) => edge.source === nodeData.id && eventSources.includes(edge.sourceHandle || '')).flatMap((edge) => nodesById[edge.target] ? [nodesById[edge.target]] : []);

  if (opts?.forceExecution) {
    nextNodes.push(...opts.forceExecution.map(id => nodesById[id]));
  }

  const outputs = {} as Record<string, unknown>;

  for (const nextNode of nextNodes) {
    const { data } = nextNode;
    const { type } = data;

    const client = ctx.objectClient<ExecutableNode>({ name: type }, ctx.key) as { executeNode: (p: ExecuteNodeFunctionProps) => Promise<Record<string, unknown>> };

    const r = await client.executeNode({ executionId, nodeData: data, yaml, domain, token, result }) || {};

    Object.assign(outputs, r);
  }

  return outputs;

}