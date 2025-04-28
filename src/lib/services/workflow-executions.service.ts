import { inject, injectable } from 'tsyringe';
import { RESTATE_CONTEXT_TOKEN } from '../injector/tokens';
import { KeyValueService } from './key-value.service';

import { yamlToWorkflow } from "@/app/(modules)/(private)/(workflows)/(components)/yaml/converter";
import { NodeData } from "@/app/(modules)/(private)/(workflows)/(components)/yaml/types";
import { ExecutableNode, ExecuteNodeFunctionProps } from "@/app/(modules)/(private)/(workflows)/types";
import * as restate from "@restatedev/restate-sdk/fetch";
import { get, set } from "lodash";
import Mustache from 'mustache';
import { SystemTriggersService } from './system-triggers.service';
import { TriggerBuilder } from '../triggers-utils';
import { SystemTrigger } from '../entities';
import { WorkflowsService } from './workflows.service';
import { UsersService } from './users.service';
import { Service, token } from './service';

export type NextNodeOrExecutionArgs = StandardNodeArgs & {
  nextNodes?: NodeData[],
  executionId: string,
  localResult: Record<string, unknown>,
  globalResult: Record<string, unknown>,
  domain: string,
  token: string,
  resumableId?: string,
  resumableResult?: Record<string, unknown>,
};

export type StandardNodeArgs = {
  workflowId: string,
  nodeData: NodeData;
  event: string;
}

export type ForceNextNodeArgs = {
  forceExecution: string[];
}

export type ResumableArgs = NextNodeOrExecutionArgs & { maxCalls: number }

@injectable()
export class WorkflowExecutionsService extends Service {
  private readonly KEY_PREFIX = 'workflow-executions';

  static dependencies() {
    return [
      UsersService,
      token<restate.ObjectContext>(RESTATE_CONTEXT_TOKEN),
      KeyValueService,
      SystemTriggersService,
      WorkflowsService
    ]
  }

  constructor(
    @inject(UsersService) private readonly usersService: UsersService,
    @inject(RESTATE_CONTEXT_TOKEN) private readonly restateContext: restate.ObjectContext,
    @inject(KeyValueService) private keyValueService: KeyValueService,
    @inject(SystemTriggersService) private readonly systemTriggerService: SystemTriggersService,
    @inject(WorkflowsService) private readonly workflowService: WorkflowsService,
  ) { super(); }

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
    const prePhaseFlattened = this.flattenObject(config);
    const resolvedConfig = {};
    Object.entries(prePhaseFlattened).forEach(([key, value]) => {
      let parsedValue;

      if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
        const path = value.slice(2, -2);
        parsedValue = get(result, path);
      }

      set(resolvedConfig, key, parsedValue || value);
    });

    const configString = JSON.stringify(resolvedConfig);
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

      set(resolved, key, parsedValue);
    });

    return resolved;
  }

  protected mergeResult(ctx: Record<string, unknown>, newResult: Record<string, unknown>, nodeName: string, eventName: string) {
    return set(ctx, [nodeName, eventName], newResult);
  }

  getNextNodes({ nodeData, event, yaml }: Omit<StandardNodeArgs, 'workflowId'> & { yaml: string }, opts?: ForceNextNodeArgs): NodeData[] {
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
    const { workflowId } = args;
    const { yaml } = await this.workflowService.loadWorkflow(workflowId);
    const { executionId, nodeData, domain, token, globalResult, localResult, event, nextNodes = this.getNextNodes({ nodeData, event, yaml }), resumableId, resumableResult } = args;
    const result = this.mergeResult(globalResult, localResult, nodeData.name, event);
    await this.putExecution(executionId, args);

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

      const r = await client.executeNode({ executionId, nodeData: data, yaml, domain, token, result, sourceEvent: event, resumableId, resumableResult, workflowId }) || {};

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
  async createResumable(args: Omit<ResumableArgs, 'maxCalls'> & { maxCalls?: number }, triggerRef?: TriggerBuilder, inputs: Record<string, unknown> = {}): Promise<string> {
    const user = await this.usersService.getSessionUser();
    args.maxCalls = args.maxCalls || -1;
    const resumableId = this.restateContext.rand.uuidv4();
    await this.putExecution(resumableId, args)
    const { workflowId } = args;
    const { yaml } = await this.workflowService.loadWorkflow(workflowId);
    const { executionId } = args;
    const { workflow } = yamlToWorkflow(yaml);

    // if you do not pass a trigger, we will create one, but this trigger we create is not triggered by any log in the system
    // so you will have to grab the ID to resume the execution manually later on potentially.
    const trigger = (
      triggerRef || new TriggerBuilder(resumableId)
        .matchMessage(`resume::${executionId}::${resumableId}`)
    )
      .resumeWorkflow(workflow.id, args.nodeData.id, { ...inputs, executionId })
      .build();

    trigger.id = resumableId;

    await this.systemTriggerService.putTrigger(resumableId, SystemTrigger.fromTriggerDefinition(trigger, {
      createdBy: user?.email || 'system',
      workflowId: workflow.id,
      active: true
    }));

    return resumableId;
  }

  /**
   * This will take a resumable at any point of time, and call `nextOrEndExecution` with the same arguments
   * @param resumableId 
   */
  async resumeExecution({ resumableId, result, domain, token, workflowId }: { resumableId: string, result: object, domain: string, token: string, workflowId: string }) {
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

    const actualArgs = await this.getExecution(resumableId);

    return await this.nextOrEndExecution({
      executionId: resumableId,
      nodeData: actualArgs.nodeData,
      localResult: actualArgs.localResult,
      globalResult: actualArgs.globalResult,
      domain: domain,
      token: token,
      nextNodes: actualArgs.nextNodes,
      event: actualArgs.event,
      resumableId,
      resumableResult: result as any,
      workflowId: actualArgs.workflowId || workflowId,
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

  async putExecution(executionId: string, props: NextNodeOrExecutionArgs) {
    const user = await this.usersService.getSessionUser();
    const exec = await this.keyValueService.findByKey(`${this.KEY_PREFIX}::${executionId}`);
    if (exec) {
      await this.keyValueService.update(exec.id, {
        value: JSON.stringify(props),
      })
    } else {
      await this.keyValueService.create({
        key: `${this.KEY_PREFIX}::${executionId}`,
        value: JSON.stringify(props),
        createdBy: user?.email || 'system'
      })
    }
  }
}
