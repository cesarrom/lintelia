import { KeyValueService } from './key-value.service';

import * as restate from "@restatedev/restate-sdk/fetch";
import { get, set } from "lodash";
import Mustache from 'mustache';
import { SystemTriggersService } from './system-triggers.service';
import { WorkflowsService } from './workflows.service';
import { AbstractService } from './service';
import { WebService } from './web.service';
import assert from 'assert';
import { ForceNextNodeArgs, NextNodeOrExecutionArgs, NodeData, ResumableArgs, ResumeWorkflowRequest, StandardNodeArgs } from '@repo/lintelia/schemas';
import { fromTriggerDefinition, TriggerBuilder, yamlToWorkflow } from '@repo/lintelia/utilities';
import { ExecutableNode, ExecuteNodeFunctionProps } from '../utils/restate-utils';
import { Injectable, Inject, Scope } from "@nestjs/common";

@Injectable({
  scope: Scope.REQUEST
})
export class WorkflowExecutionsService extends AbstractService {
  private readonly KEY_PREFIX = 'workflow-executions';

  constructor(
    @Inject(KeyValueService) private keyValueService: KeyValueService,
    @Inject(SystemTriggersService) private readonly systemTriggerService: SystemTriggersService,
    @Inject(WorkflowsService) private readonly workflowService: WorkflowsService,
    @Inject(WebService) private readonly webService: WebService,
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

  getNodeById({ nodeId, yaml }: { nodeId: string, yaml: string }): NodeData | undefined {
    const { nodes } = yamlToWorkflow(yaml);
    return nodes.find(node => node.data.id === nodeId)?.data;
  }

  getNextNodes({ nodeId, event, yaml }: Omit<StandardNodeArgs, 'workflowId'> & { yaml: string }, opts?: ForceNextNodeArgs): NodeData[] {
    const nodeData = this.getNodeById({ nodeId, yaml });

    assert(nodeData, 'Node not found');

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

  async nextOrEndExecution(c: restate.ObjectContext, args: NextNodeOrExecutionArgs) {
    const { workflowId, nodeId } = args;
    const { yaml } = await this.workflowService.loadWorkflow(workflowId);

    const nodeData = this.getNodeById({ nodeId, yaml });

    assert(nodeData, 'Node not found');

    const { executionId, domain, token, globalResult, localResult, event, nextNodes = this.getNextNodes({ nodeId, event, yaml }), resumableId, resumableResult } = args;
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

      const client = c.objectClient<ExecutableNode>({ name: type }, c.key) as { executeNode: (p: ExecuteNodeFunctionProps) => Promise<Record<string, unknown>> };

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
  async createResumable(c: restate.ObjectContext, args: Omit<ResumableArgs, 'maxCalls'> & { maxCalls?: number }, triggerRef?: TriggerBuilder, inputs: Record<string, unknown> = {}): Promise<string> {
    const user = await this.webService.getSessionUser();
    args.maxCalls = args.maxCalls || -1;
    const resumableId = c.rand.uuidv4();
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
      .resumeWorkflow(workflow.id, args.nodeId, { ...inputs, executionId })
      .build();

    trigger.id = resumableId;

    await this.systemTriggerService.putTrigger(resumableId, fromTriggerDefinition(trigger, {
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
  async resumeExecution(c: restate.ObjectContext, { resumableId, result, domain, token, workflowId }: ResumeWorkflowRequest) {
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

    return await this.nextOrEndExecution(c,{
      executionId: resumableId,
      nodeId: actualArgs.nodeId,
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
    await this.keyValueService.update(exec.id!, {
      value: JSON.stringify(props),
    })
  }

  async putExecution(executionId: string, props: NextNodeOrExecutionArgs) {
    const user = await this.webService.getSessionUser();
    const exec = await this.keyValueService.findByKey(`${this.KEY_PREFIX}::${executionId}`);
    if (exec) {
      await this.keyValueService.update(exec.id!, {
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
