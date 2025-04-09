import { inject, injectable } from 'tsyringe';
import { RESTATE_CONTEXT_TOKEN, USER_TOKEN } from '../injector/tokens';
import { KeyValueService } from './key-value.service';

import { yamlToWorkflow } from "@/app/(modules)/(private)/(workflows)/(components)/yaml/converter";
import { NodeData } from "@/app/(modules)/(private)/(workflows)/(components)/yaml/types";
import { ExecutableNode, ExecuteNodeFunctionProps } from "@/app/(modules)/(private)/(workflows)/types";
import * as restate from "@restatedev/restate-sdk/fetch";
import { set } from "lodash";
import Mustache from 'mustache';
import { SystemTriggersService } from './system-triggers.service';
import { TriggerBuilder, TriggerDefinition } from '../triggers-utils';
import { SystemTrigger } from '../entities/tenant';
import { User } from '@/types/auth';

export type NextNodeOrExecutionArgs = StandardNodeArgs & {
  nextNodes?: NodeData[],
  executionId: string,
  localResult: Record<string, unknown>,
  globalResult: Record<string, unknown>,
  domain: string,
  token: string,
  resumableId?: string,
  resumableResult?: Record<string, unknown>
};

export type StandardNodeArgs = {
  yaml: string;
  nodeData: NodeData;
  event: string;
}

export type ForceNextNodeArgs = {
  forceExecution: string[];
}

export type ResumableArgs = NextNodeOrExecutionArgs & { maxCalls: number }

@injectable()
export class WorkflowExecutionsService {
  private readonly KEY_PREFIX = 'workflow-executions';
  constructor(
    @inject(USER_TOKEN) private readonly user: User | null,
    @inject(RESTATE_CONTEXT_TOKEN) private readonly restateContext: restate.ObjectContext,
    @inject(KeyValueService) private keyValueService: KeyValueService,
    @inject(SystemTriggersService) private readonly systemTriggerService: SystemTriggersService,
  ) { }

  protected flattenObject(ob: Record<string, unknown>): Record<string, unknown> {
    const toReturn: Record<string, unknown> = {};

    for (const i in ob) {
      if (!Object.prototype.hasOwnProperty.call(ob, i)) continue;

      if (typeof ob[i] === 'object' && ob[i] !== null) {
        const flatObject = this.flattenObject(ob[i] as Record<string, unknown>);
        for (const x in flatObject) {
          if (!Object.prototype.hasOwnProperty.call(flatObject, x)) continue;

          toReturn[`${i}.${x}`] = flatObject[x];
        }
      } else {
        toReturn[i] = ob[i];
      }
    }
    return toReturn;
  }

  getConfiguration(config: Record<string, unknown>, result: Record<string, unknown> = {}): Record<string, unknown> {
    const configString = JSON.stringify(config);
    const renderedString = Mustache.render(configString, result);
    const object = JSON.parse(renderedString);
    const flattened = this.flattenObject(object);
    const resolved = {};

    Object.entries(flattened).forEach(([key, value]) => {
      let parsedValue;
      try {
        parsedValue = JSON.parse(value as string);
      } catch {
        parsedValue = value;
      }
      return set(resolved, key, parsedValue);
    });

    return resolved;
  }

  protected mergeResult(ctx: Record<string, unknown>, newResult: Record<string, unknown>, nodeName: string, eventName: string) {
    return set(ctx, [nodeName, eventName], newResult);
  }

  getNextNodes({ nodeData, event, yaml }: StandardNodeArgs, opts?: ForceNextNodeArgs): NodeData[] {
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

    return nextNodes.map(n => n.data)
  }

  async nextOrEndExecution(args: NextNodeOrExecutionArgs) {
    const { executionId, nodeData, yaml, domain, token, globalResult, localResult, event, nextNodes = this.getNextNodes({ nodeData, event, yaml }), resumableId, resumableResult } = args;
    const result = this.mergeResult(globalResult, localResult, nodeData.name, event);
    await this.updateExecution(executionId, args);

    // we evaluate if this node exports this particular event
    const exporting = nodeData.exports?.find(e => e.event === event);

    if (exporting) {
      const { outputs } = exporting;

      return { [event]: this.getConfiguration(Object.fromEntries(outputs.map(o => [o.name, o.value] as const)), result) };
    }

    const outputs = {} as Record<string, unknown>;

    for (const data of nextNodes) {
      const { type } = data;

      const client = this.restateContext.objectClient<ExecutableNode>({ name: type }, this.restateContext.key) as { executeNode: (p: ExecuteNodeFunctionProps) => Promise<Record<string, unknown>> };

      const r = await client.executeNode({ executionId, nodeData: data, yaml, domain, token, result, sourceEvent: event, resumableId, resumableResult }) || {};

      Object.assign(outputs, r);
    }

    return outputs;

  }
  /**
   * Call this function instead of `nextOrEndExecution` when you want to create a resumable
   * this method was created to replace `restate.awakeable()` because to our understanding, it is not possible to call one awakeable many times, it is sequential, you call it once, and that is it
   * meanwhile, this method allows you to create a resumable that can be called multiple times
   * @param args
   * @returns 
   */
  async createResumable(args: Omit<ResumableArgs, 'maxCalls'> & { maxCalls?: number }, triggerRef?: TriggerBuilder): Promise<string> {
    args.maxCalls = args.maxCalls || -1;
    const resumableId = this.restateContext.rand.uuidv4();
    const { executionId } = args;
    const { workflow } = yamlToWorkflow(args.yaml);

    // if you do not pass a trigger, we will create one, but this trigger we create is not triggered by any log in the system
    // so you will have to grab the ID to resume the execution manually later on potentially.
    const trigger = (
      triggerRef || new TriggerBuilder(resumableId)
        .matchMessage(`resume::${executionId}::${resumableId}`)
        .resumeWorkflow(workflow.id, args.nodeData.id, args)
    )
      .build();

    trigger.id = resumableId;

    await this.systemTriggerService.createTrigger(SystemTrigger.fromTriggerDefinition(trigger, {
      createdBy: this.user?.email || 'system',
      workflowId: workflow.id,
      active: true
    }));

    return resumableId;
  }

  /**
   * This will take a resumable at any point of time, and call `nextOrEndExecution` with the same arguments
   * @param resumableId 
   */
  async resumeExecution({ resumableId, result, domain, token }: { resumableId: string, result: object, domain: string, token: string }) {
    const trigger = await this.systemTriggerService.findTriggerById(resumableId);

    if (!trigger) {
      throw new Error(`Trigger ${resumableId} not found`);
    }

    const args = trigger.action.inputs as ResumableArgs;

    if (args.maxCalls !== -1) {
      args.maxCalls -= 1;
      trigger.action.inputs = args;
      if (args.maxCalls === 0) {
        await this.systemTriggerService.deleteTriggerById(resumableId);
      } else {
        await this.systemTriggerService.replaceTrigger(resumableId, trigger);
      }
    }

    return await this.nextOrEndExecution({
      executionId: args.executionId,
      nodeData: args.nodeData,
      localResult: args.localResult,
      globalResult: args.globalResult,
      yaml: args.yaml,
      domain: domain,
      token: token,
      nextNodes: args.nextNodes,
      event: args.event,
      resumableId,
      resumableResult: result as any,
    });
  }

  async deleteResumable(resumableId: string): Promise<void> {
    await this.systemTriggerService.deleteTriggerById(resumableId);
  }

  async getExecution(executionId: string) {
    const exec = await this.keyValueService.findByKey(`${this.KEY_PREFIX}::${executionId}`);
    if (!exec) {
      throw new Error(`Execution ${executionId} not found`);
    }
    return JSON.parse(exec.value) as NextNodeOrExecutionArgs;
  }

  async updateExecution(executionId: string, props: NextNodeOrExecutionArgs) {
    const exec = await this.keyValueService.findByKey(`${this.KEY_PREFIX}::${executionId}`);
    if (!exec) {
      throw new Error(`Execution ${executionId} not found`);
    }
    await this.keyValueService.update(exec.id, {
      value: JSON.stringify(props),
    })
  }
}
