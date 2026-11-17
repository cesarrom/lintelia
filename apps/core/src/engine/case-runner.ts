import * as restate from '@restatedev/restate-sdk/fetch';
import { set } from 'lodash';
import type { Tenant } from '@repo/fintivio/schemas';
import { CaseRepository, isFinalStatus } from './case-repository';
import { hookUrl, SIGNAL_NAME } from './signals';
import { parseDefinition, type StepDefinition } from './definition';
import { resolveConfig } from './expressions';
import { Notifier } from './notifier';
import type { AuditWriter } from '../services/audit.writer';
import type { TenantDirectory } from '../services/tenant-directory.service';
import { INTERNAL_SIGNATURE_HEADER, verifyInternalSignature } from '../auth/internal-signature';
import { getComponent } from './components';
import { WORKFLOW_ACTOR, type EngineDeps, type EngineServices, type StepResult, type TaskSignal } from './components/types';

export type { TaskSignal } from './components/types';

export interface CaseRunInput {
  tenantId: string;
  caseId: string;
}

export interface CaseEngineDeps {
  repository: CaseRepository;
  audit: AuditWriter;
  notifier: Notifier;
  directory: TenantDirectory;
  services?: EngineServices;
}

const RESERVED_VARS = new Set(['input', 'case', 'steps']);
const MAX_STEPS = 500;

/**
 * The case engine: one durable Restate workflow per case (key = case id) interpreting the published workflow version.
 * It runs as the workflow principal: it only knows the tenant and the case, never a user's token. Human steps wait on
 * durable promises resolved by the API (`signal`), with SLA timers for escalation and client-request expiry.
 */
export function createCaseRunner({ repository, audit, notifier, directory, services = {} }: CaseEngineDeps) {
  const verify = (ctx: restate.WorkflowSharedContext, input: CaseRunInput) => {
    const signature = ctx.request().headers.get(INTERNAL_SIGNATURE_HEADER);
    if (ctx.key !== input?.caseId || !verifyInternalSignature(signature, input.tenantId, input.caseId)) {
      throw new restate.TerminalError('Forbidden', { errorCode: 403 });
    }
  };

  const loadTenant = async (tenantId: string): Promise<Tenant> => {
    const tenant = await directory.findById(tenantId);
    if (!tenant) throw new restate.TerminalError('Tenant not found');
    return tenant;
  };
  const deps: EngineDeps = { repository, audit, notifier, loadTenant, services };

  /**
   * Every durable action of a case (`ctx.run`) fails for good once its institution no longer exists (deleted while the
   * case ran, e.g. the welcome workflow of a test institution): retrying could never succeed.
   */
  function guardTenant(ctx: restate.WorkflowContext, tenantId: string): restate.WorkflowContext {
    const run = (...args: unknown[]) => {
      const index = typeof args[0] === 'function' ? 0 : 1;
      const action = args[index] as () => Promise<unknown>;
      args[index] = async () => {
        try {
          return await action();
        } catch (error) {
          if (!(error instanceof restate.TerminalError) && !(await directory.findById(tenantId).catch(() => true))) {
            throw new restate.TerminalError('The institution of this case no longer exists');
          }
          throw error;
        }
      };
      return (ctx.run as (...a: unknown[]) => unknown)(...args);
    };
    return new Proxy(ctx, {
      get(target, prop) {
        if (prop === 'run') return run;
        const value = Reflect.get(target, prop, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  }

  async function run(ctx: restate.WorkflowContext, input: CaseRunInput) {
    return runCase(input?.tenantId ? guardTenant(ctx, input.tenantId) : ctx, input);
  }

  async function runCase(ctx: restate.WorkflowContext, input: CaseRunInput) {
    verify(ctx, input);
    const { tenantId, caseId } = input;
    const kase = await ctx.run('load-case', () => repository.getCase(tenantId, caseId));
    if (!kase) throw new restate.TerminalError('Case not found');
    const version = await ctx.run('load-definition', async () => (await repository.version(tenantId, kase.workflowId, kase.workflowVersion))?.yaml ?? null);
    if (!version) throw new restate.TerminalError('Workflow version not found');
    const definition = parseDefinition(version);
    const steps = new Map(definition.steps.map((step) => [step.id, step]));
    const start = definition.steps.find((step) => step.type === 'start');
    if (!start) throw new restate.TerminalError('Workflow has no start step');

    // Signed addresses external systems call to signal the case (`webhook.wait` steps), known from the start.
    const hooks = Object.fromEntries(definition.steps.filter((s) => s.type === 'webhook.wait' && SIGNAL_NAME.test(String(s.config?.name ?? '')))
      .map((s) => [String(s.config.name), hookUrl(tenantId, caseId, String(s.config.name))]));
    const vars: Record<string, any> = {
      input: kase.data,
      case: { id: kase.id, reference: kase.reference, title: kase.title, applicant: { id: kase.applicantId, email: kase.applicantEmail, name: kase.applicantName }, hooks },
      steps: {},
    };

    await ctx.run('case-started', async () => {
      await repository.updateCase(tenantId, caseId, { status: 'in_progress' });
      await audit.record(tenantId, WORKFLOW_ACTOR, 'case.started', { type: 'case', id: caseId }, { workflowVersion: kase.workflowVersion }, caseId);
    });

    const queue: StepDefinition[] = [start];
    let count = 0;
    while (queue.length) {
      if (++count > MAX_STEPS) throw new restate.TerminalError('Too many steps executed (is there a loop?)');
      const step = queue.shift()!;
      const label = `${step.id}#${count}`;
      let result: StepResult;
      try {
        result = await executeStep(ctx, step, label, vars, tenantId, caseId);
      } catch (error) {
        if (error instanceof restate.TerminalError) {
          await ctx.run(`failed-${label}`, async () => {
            await repository.updateCase(tenantId, caseId, { status: 'failed', completedAt: new Date() });
            await audit.record(tenantId, WORKFLOW_ACTOR, 'case.failed', { type: 'case', id: caseId }, { step: step.id, error: error.message }, caseId);
          });
          if (kase.parentCaseId && services.notifyParent) {
            await ctx.run(`notify-parent-failed-${label}`, () => services.notifyParent!(tenantId, caseId, { outcome: 'failed', output: { caseId, reference: kase.reference, status: 'failed', error: error.message } }));
          }
        }
        throw error;
      }
      vars.steps[step.id] = result.output;
      if (!RESERVED_VARS.has(step.name) && result.event) set(vars, [step.name, result.event], result.output);
      await ctx.run(`result-${label}`, () => repository.saveResult(tenantId, caseId, step.id, result.output));
      // Branches may use a component's short names (a review's `approve` for `review_approved`).
      const aliases = getComponent(step.type)?.definition.events.aliases ?? {};
      const next = (step.events.find((event) => event.name === result.event) ?? step.events.find((event) => aliases[event.name] === result.event))?.next ?? [];
      for (const id of next) queue.push(steps.get(id)!);
    }

    const final = await ctx.run('case-finished', async () => {
      const current = await repository.getCase(tenantId, caseId);
      if (current && !isFinalStatus(current.status)) {
        await repository.updateCase(tenantId, caseId, { status: 'completed', completedAt: new Date() });
        await audit.record(tenantId, WORKFLOW_ACTOR, 'case.completed', { type: 'case', id: caseId }, {}, caseId);
        return { status: 'completed', outcome: current.outcome ?? 'completed' };
      }
      return { status: current?.status ?? 'completed', outcome: current?.outcome ?? current?.status ?? 'completed' };
    });
    // What the case gives back to its caller (functions, sub-workflows).
    const outputs = Object.keys(definition.outputs).length
      ? await ctx.run('case-outputs', async () => {
        const values = await resolveConfig(definition.outputs, vars) as Record<string, unknown>;
        await repository.saveResult(tenantId, caseId, '_outputs', values);
        return values;
      })
      : {};
    if (kase.parentCaseId && services.notifyParent) {
      await ctx.run('notify-parent', () => services.notifyParent!(tenantId, caseId, {
        outcome: 'completed', output: { caseId, reference: kase.reference, status: final.status, outcome: final.outcome, results: vars.steps, outputs },
      }));
    }
    return { caseId, steps: count };
  }

  async function executeStep(ctx: restate.WorkflowContext, step: StepDefinition, label: string, vars: Record<string, any>, tenantId: string, caseId: string): Promise<StepResult> {
    const component = getComponent(step.type);
    if (!component) throw new restate.TerminalError(`Unsupported step type ${step.type}`);
    const config = component.resolveConfig === false
      ? (step.config ?? {})
      : await ctx.run(`config-${label}`, () => resolveConfig(step.config ?? {}, vars)) as Record<string, any>;
    return component.execute({ ctx, step, label, config, vars, tenantId, caseId, deps });
  }

  return restate.workflow({
    name: 'caseRun',
    handlers: {
      run,
      /** Resolve the durable promise of a task (decision or client answer). Only the API can call it (signature). */
      signal: restate.handlers.workflow.shared(async (ctx: restate.WorkflowSharedContext, input: CaseRunInput & { taskId: string; signal: TaskSignal }) => {
        verify(ctx, input);
        await ctx.promise<TaskSignal>(`task:${input.taskId}`).resolve(input.signal);
      }),
      /** Resolve a named promise: connector callbacks (`connector:*`) and child cases (`child:*`). API only. */
      resolve: restate.handlers.workflow.shared(async (ctx: restate.WorkflowSharedContext, input: CaseRunInput & { promise: string; signal: TaskSignal }) => {
        verify(ctx, input);
        if (!/^(connector|child|party|hook):/.test(input.promise)) throw new restate.TerminalError('Unknown promise', { errorCode: 400 });
        await ctx.promise<TaskSignal>(input.promise).resolve(input.signal);
      }),
    },
  });
}

export { interpolate } from './expressions';
