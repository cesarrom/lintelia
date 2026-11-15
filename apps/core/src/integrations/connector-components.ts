import * as restate from '@restatedev/restate-sdk/fetch';
import {
  connectorComponentType, parseConnectorComponentType,
  type ComponentDefinition, type ConnectorComponentManifest, type ConnectorManifest, type JsonSchema,
} from '@repo/fintivio/schemas';
import type { EngineComponent, TaskSignal } from '../engine/components/types';
import { WORKFLOW_ACTOR } from '../engine/components/types';
import { durationMs } from '../engine/durations';
import { connectorUrl } from './registry';

/** Component definition (catalogue entry) of a connector component. */
export function connectorComponentDefinition(manifest: ConnectorManifest, component: ConnectorComponentManifest, installation?: { id: string; displayName: string }): ComponentDefinition {
  const inputProperties = ((component.inputSchema as JsonSchema).properties ?? {}) as Record<string, JsonSchema>;
  const configProperties = ((component.configSchema as JsonSchema).properties ?? {}) as Record<string, JsonSchema>;
  const clientStep = component.kind === 'client_step';
  const events = [...new Set([...component.events, ...((component.invoke.mode === 'async' && component.invoke.timeout) || clientStep ? ['expired'] : [])])];
  return {
    type: connectorComponentType(manifest.id, component.key),
    version: component.version,
    title: component.title,
    description: component.description,
    icon: component.icon ?? manifest.icon ?? 'Plug',
    category: component.category as ComponentDefinition['category'],
    kind: component.kind === 'client_step' ? 'client' : 'automatic',
    source: { kind: 'connector', connectorId: manifest.id, installationId: installation?.id, installationName: installation?.displayName ?? manifest.name },
    configSchema: {
      type: 'object',
      required: ['connection', ...(((component.configSchema as JsonSchema).required as string[] | undefined) ?? [])],
      properties: {
        connection: { type: 'string', title: 'Connection', description: `which ${manifest.name} connection to use`, 'x-widget': 'connection' },
        ...configProperties,
        // Client steps: the core reminds the client and expires the step (the connector never e-mails clients).
        ...(clientStep ? {
          remindAfter: { type: 'string', title: 'Remind the client after', description: 'ISO-8601 duration, e.g. P2D', 'x-widget': 'duration' },
          expiresAfter: { type: 'string', title: 'Expire after', description: `ISO-8601 duration (default ${component.invoke.timeout ?? 'P7D'})`, 'x-widget': 'duration' },
        } : {}),
        input: {
          type: 'object',
          title: 'Inputs',
          description: 'values from the case, e.g. {{case.applicant.email}} or =input.fullName',
          required: ((component.inputSchema as JsonSchema).required as string[] | undefined) ?? [],
          properties: Object.fromEntries(Object.entries(inputProperties).map(([key, schema]) => [key, { ...schema, type: 'string', 'x-expression': true }])),
        },
      },
    },
    defaults: { ...(installation ? { connection: installation.id } : {}), ...(component.defaults ?? {}) },
    summary: component.summary ?? `${manifest.name} · {{connection}}`,
    events: { static: events },
  };
}

/** The engine side of a connector component: invoke the connector, then (async) wait for its callback. */
export function connectorEngineComponent(manifest: ConnectorManifest, component: ConnectorComponentManifest): EngineComponent {
  const definition = connectorComponentDefinition(manifest, component);
  return {
    definition,
    validate: (config) => (config.connection ? [] : ['needs a connection']),
    async execute({ ctx, step, label, config, tenantId, caseId, deps }) {
      const invoke = deps.services.invokeConnector;
      if (!invoke) throw new restate.TerminalError('Connector components are not available in this engine');
      const callbackPromise = `connector:${step.id}:${label}`.slice(0, 150);
      const { connection, input, remindAfter, expiresAfter, ...rest } = config;
      const result = await ctx.run(`invoke-${label}`, () => invoke({
        tenantId, caseId, stepId: step.id, componentType: definition.type,
        config: { ...rest, connection }, input: (input ?? {}) as Record<string, unknown>,
        idempotencyKey: `${caseId}:${label}`, callbackPromise,
      }));
      if (result.mode === 'sync') return { event: result.outcome, output: result.output };

      let taskId: string | null = null;
      if (result.clientAction) {
        taskId = ctx.rand.uuidv4();
        const action = result.clientAction;
        await ctx.run(`client-step-${label}`, async () => {
          const kase = (await deps.repository.getCase(tenantId, caseId))!;
          await deps.repository.createTask(tenantId, {
            id: taskId!, caseId, stepId: step.id, audience: 'client', kind: 'connector_step',
            title: action.title ?? component.title, description: action.instructions ?? component.description,
            assigneeId: kase.applicantId, clientAction: action,
          });
          await deps.repository.updateCase(tenantId, caseId, { status: 'pending_client' });
          await deps.audit.record(tenantId, WORKFLOW_ACTOR, 'client_request.created', { type: 'task', id: taskId!, title: action.title ?? component.title }, { connector: manifest.id }, caseId);
          if (kase.applicantEmail) {
            const tenant = await deps.loadTenant(tenantId);
            const link = deps.notifier.requestLink(tenant, kase);
            await deps.notifier.send(tenant, kase.applicantEmail, link.subject, [action.title ?? component.title, ...(action.instructions ? [action.instructions] : [])], { label: link.label, url: link.url });
          }
        });
      }

      const timeout = durationMs(expiresAfter) ?? durationMs(component.invoke.timeout) ?? (component.kind === 'client_step' ? durationMs('P7D') : null);
      const remind = component.kind === 'client_step' ? durationMs(remindAfter) : null;
      const promise = ctx.promise<TaskSignal>(callbackPromise);
      let signal: TaskSignal;
      try {
        if (remind && timeout && remind < timeout) {
          try {
            signal = await promise.get().orTimeout(remind);
          } catch (error) {
            if (!(error instanceof restate.TimeoutError)) throw error;
            await ctx.run(`remind-${label}`, async () => {
              const kase = (await deps.repository.getCase(tenantId, caseId))!;
              if (kase.applicantEmail) {
                const tenant = await deps.loadTenant(tenantId);
                const link = deps.notifier.requestLink(tenant, kase);
                await deps.notifier.send(tenant, kase.applicantEmail, `Reminder: ${link.subject}`, ['We are still waiting for you to complete this step.', component.title], { label: link.label, url: link.url });
              }
              await deps.audit.record(tenantId, WORKFLOW_ACTOR, 'client_request.reminded', { type: 'task', id: taskId }, { connector: manifest.id }, caseId);
            });
            signal = await promise.get().orTimeout(timeout - remind);
          }
        } else {
          signal = timeout ? await promise.get().orTimeout(timeout) : await promise.get();
        }
      } catch (error) {
        if (!(error instanceof restate.TimeoutError)) throw error;
        await ctx.run(`expired-${label}`, async () => {
          if (taskId) await deps.repository.updateTask(tenantId, taskId, { status: 'expired' });
          await deps.audit.record(tenantId, WORKFLOW_ACTOR, 'connector.step_expired', { type: 'case', id: caseId }, { connector: manifest.id, component: component.key }, caseId);
        });
        return { event: 'expired', output: { expired: true } };
      }
      await ctx.run(`completed-${label}`, async () => {
        if (taskId) await deps.repository.updateTask(tenantId, taskId, { status: 'completed' });
        await deps.repository.updateCase(tenantId, caseId, { status: 'in_progress' });
      });
      return { event: signal.outcome, output: signal.output ?? {} };
    },
  };
}

/** Resolver plugged into the engine's component registry: `connector:<id>/<key>` → the approved manifest's component. */
export function connectorComponentResolver(manifestOf: (connectorId: string) => ConnectorManifest | null) {
  const cache = new Map<string, { manifest: ConnectorManifest; component: EngineComponent }>();
  return (type: string): EngineComponent | null => {
    const parsed = parseConnectorComponentType(type);
    if (!parsed) return null;
    const manifest = manifestOf(parsed.connectorId);
    if (!manifest) return null;
    const cached = cache.get(type);
    if (cached && cached.manifest === manifest) return cached.component;
    const component = manifest.components.find((c) => c.key === parsed.key);
    if (!component) return null;
    const engineComponent = connectorEngineComponent(manifest, component);
    cache.set(type, { manifest, component: engineComponent });
    return engineComponent;
  };
}

export { connectorUrl };
