import { parseDefinition, type StepDefinition, type WorkflowDefinition } from '../engine/definition';

/**
 * The experience map (docs/plans/13): what an institution built, as one connected picture — the client app's pages
 * and journeys, each journey's touchpoints (the screens and requests a client sees, in the order the workflow shows
 * them, with what happens in between), the workflows, functions, forms and the events that start them.
 *
 * This module is pure: it turns workflow YAML into the map's workflow view. The service gathers the inputs.
 */

export interface ComponentInfo {
  title: string;
  /** Catalogue kind: `client` marks a touchpoint (the client sees something and acts). */
  kind: string;
  category: string;
  icon?: string;
  connectorId?: string;
  connectorName?: string;
}

export type Describe = (type: string) => ComponentInfo | null;

export interface MapField { key: string; label: string; type: string; required: boolean; options?: Array<{ value: string; label: string }>; placeholder?: string; default?: string; help?: string; optionsFrom?: string; visibleIf?: string; width?: string }
export interface MapButton { key: string; label: string; style: string }

/** Something the client sees and acts on: a screen, a request (documents, answers), a form, a vendor page. */
export interface MapTouchpoint {
  stepId: string;
  kind: 'screen' | 'request' | 'form' | 'action' | 'parties';
  name: string;
  title: string;
  description?: string;
  content?: string;
  stage?: string;
  fields: MapField[];
  buttons: MapButton[];
  /** Requests: what is asked (uploads, answers). */
  items: Array<{ key: string; label: string; type: string }>;
  formId?: string;
  connector?: { id: string; name: string; component: string };
  /** Events leaving the touchpoint (buttons, or the request's outcomes). */
  events: Array<{ key: string; label: string }>;
  /** Screens that continue by themselves (docs/plans/14): the button pressed, and when. */
  autoSubmit?: { button: string; when: string; delay?: number };
}

/** A step passed between two touchpoints. */
export interface MapViaStep {
  stepId: string;
  name: string;
  type: string;
  group: 'people' | 'connector' | 'function' | 'workflow' | 'signal' | 'notify' | 'auto';
  detail?: string;
  /** A review that may send questions back to the client (request_info). */
  asksClient?: boolean;
}

export interface MapEnd { id: string; status: string; outcome: string | null; label: string }

/** From a touchpoint's event (or the start) to the next touchpoints or ends, through the steps in between. */
export interface MapFlowEdge {
  from: string;
  event: string;
  eventLabel: string;
  to: string;
  /** The last branch taken before reaching `to` (e.g. "Credit decision: Approve"). */
  branch?: string;
  via: MapViaStep[];
}

export interface MapWorkflow {
  id: string;
  name: string;
  description: string;
  status: string;
  activeVersion: number | null;
  function: boolean;
  startOn: string[];
  stages: Array<{ key: string; label: string; exit?: boolean }>;
  inputs: Array<{ name: string; label: string }>;
  outputs: string[];
  clientVisibility: string;
  stepCount: number;
  touchpoints: MapTouchpoint[];
  flow: MapFlowEdge[];
  ends: MapEnd[];
  people: Array<{ stepId: string; name: string; type: string; role: string | null }>;
  calls: Array<{ stepId: string; name: string; workflowId: string; kind: 'function' | 'call' | 'foreach'; wait: boolean }>;
  forms: Array<{ stepId: string; name: string; formId: string }>;
  connectors: Array<{ stepId: string; name: string; connectorId: string; connectorName: string; component: string; connectionId: string | null }>;
  notifies: Array<{ stepId: string; name: string; page: string; title: string }>;
  signals: Array<{ stepId: string; name: string; signal: string; timeout: string | null }>;
  error?: string;
}

const FUNCTION_TYPE = /^function:([0-9a-f-]{36})$/i;
const text = (value: unknown) => (value === undefined || value === null ? '' : String(value));
const humanize = (value: string) => value.replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

function touchpointOf(step: StepDefinition, info: ComponentInfo): MapTouchpoint {
  const config = (step.config ?? {}) as Record<string, any>;
  const base = { stepId: step.id, name: step.name, title: text(config.title) || step.name, description: text(config.description) || undefined, content: text(config.content) || undefined, stage: text(config.stage) || undefined, fields: [], buttons: [], items: [] };
  const eventsOf = () => step.events.map((e) => ({ key: e.name, label: humanize(e.name) }));
  if (step.type === 'client.screen') {
    const fields: MapField[] = (Array.isArray(config.fields) ? config.fields : []).map((f: any) => ({
      key: text(f.key), label: text(f.label) || text(f.key), type: text(f.type) || 'text', required: !!f.required, placeholder: f.placeholder ? text(f.placeholder) : undefined,
      default: f.default !== undefined && f.default !== '' ? text(f.default) : undefined, help: f.help ? text(f.help) : undefined, optionsFrom: f.optionsFrom ? text(f.optionsFrom) : undefined,
      visibleIf: f.visibleIf ? text(f.visibleIf) : undefined, width: f.width === 'half' ? 'half' : undefined,
      options: Array.isArray(f.options) ? f.options.map((o: unknown) => {
        if (o && typeof o === 'object') return { value: text((o as any).value), label: text((o as any).label ?? (o as any).value) };
        const [value, label] = text(o).split('|');
        return { value: value.trim(), label: (label ?? value).trim() };
      }) : undefined,
    }));
    const buttons: MapButton[] = (Array.isArray(config.buttons) && config.buttons.length ? config.buttons : [{ key: 'continue', label: 'Continue', style: 'primary' }])
      .map((b: any) => ({ key: text(b.key), label: text(b.label) || text(b.key), style: text(b.style) || 'primary' }));
    const auto = config.autoSubmit?.button ? { button: text(config.autoSubmit.button), when: text(config.autoSubmit.when) || 'complete', delay: Number(config.autoSubmit.delay) || 0 } : undefined;
    return { ...base, kind: 'screen', fields, buttons, events: buttons.map((b) => ({ key: b.key, label: b.label })), ...(auto ? { autoSubmit: auto } : {}) };
  }
  if (step.type === 'client.request') {
    const items = (Array.isArray(config.items) ? config.items : []).map((i: any) => ({ key: text(i.key), label: text(i.label) || text(i.key), type: text(i.type) || 'text' }));
    return { ...base, kind: 'request', items, events: eventsOf() };
  }
  if (step.type === 'form.request') return { ...base, kind: 'form', formId: text(config.formId) || undefined, events: eventsOf() };
  if (step.type === 'parties.collect') return { ...base, kind: 'parties', events: eventsOf() };
  return {
    ...base, kind: 'action', title: text(config.title) || step.name, description: text(config.instructions) || base.description,
    connector: info.connectorId ? { id: info.connectorId, name: info.connectorName ?? info.connectorId, component: info.title } : undefined, events: eventsOf(),
  };
}

function viaOf(step: StepDefinition, info: ComponentInfo | null): MapViaStep {
  const config = (step.config ?? {}) as Record<string, any>;
  const base = { stepId: step.id, name: step.name, type: step.type };
  if (step.type === 'review' || step.type === 'task') {
    const outcomes: Array<{ key: string }> = Array.isArray(config.outcomes) ? config.outcomes : [];
    const asksClient = step.type === 'review' && (!outcomes.length || outcomes.some((o) => o.key === 'request_info'));
    return { ...base, group: 'people', detail: config.assignTo?.role ? humanize(String(config.assignTo.role)) : undefined, asksClient };
  }
  if (FUNCTION_TYPE.test(step.type)) return { ...base, group: 'function', detail: info?.title };
  if (step.type === 'workflow.call' || step.type === 'foreach') return { ...base, group: 'workflow', detail: config.wait === false ? 'started, not awaited' : undefined };
  if (step.type === 'webhook.wait') return { ...base, group: 'signal', detail: text(config.name) };
  if (step.type === 'client.notify' || step.type === 'email') return { ...base, group: 'notify', detail: text(config.title) || text(config.subject) || undefined };
  if (step.type.startsWith('connector:')) return { ...base, group: 'connector', detail: info?.connectorName ?? step.type.slice(10).split('/')[0] };
  return { ...base, group: 'auto', detail: info?.title };
}

/** Label of an event of a step (review outcomes have labels; conditions are yes / no). */
function eventLabel(step: StepDefinition, event: string) {
  const config = (step.config ?? {}) as Record<string, any>;
  const outcome = (Array.isArray(config.outcomes) ? config.outcomes : []).find((o: any) => o?.key === event || (event === 'review_approved' && o?.key === 'approve') || (event === 'review_rejected' && o?.key === 'reject'));
  if (outcome?.label) return String(outcome.label);
  if (step.type === 'client.screen') {
    const button = (Array.isArray(config.buttons) ? config.buttons : []).find((b: any) => b?.key === event);
    if (button?.label) return String(button.label);
  }
  if (step.type === 'conditional') return event === 'true' ? 'yes' : event === 'false' ? 'no' : event;
  return ({ review_approved: 'Approve', review_rejected: 'Reject', approve: 'Approve', reject: 'Reject', finished: 'Start', done: 'Done' } as Record<string, string>)[event] ?? humanize(event);
}

function endOf(step: StepDefinition): MapEnd {
  const config = (step.config ?? {}) as Record<string, any>;
  if (step.type === 'case.decision') {
    const status = String(config.status ?? 'completed');
    const outcome = config.outcome && !String(config.outcome).startsWith('=') ? String(config.outcome) : null;
    return { id: `@end:${status}:${outcome ?? ''}`, status, outcome, label: outcome ? humanize(outcome) : humanize(status) };
  }
  return { id: '@end:completed:', status: 'completed', outcome: null, label: 'Ends' };
}

/** The map's view of one workflow. `describe` tells what each step type is (the component catalogue). */
export function workflowMap(input: { id: string; name: string; description?: string | null; yaml: string; status: string; activeVersion: number | null }, describe: Describe): MapWorkflow {
  const empty: MapWorkflow = {
    id: input.id, name: input.name, description: input.description ?? '', status: input.status, activeVersion: input.activeVersion, function: false, startOn: [], stages: [], inputs: [], outputs: [],
    clientVisibility: 'full', stepCount: 0, touchpoints: [], flow: [], ends: [], people: [], calls: [], forms: [], connectors: [], notifies: [], signals: [],
  };
  let definition: WorkflowDefinition;
  try {
    definition = parseDefinition(input.yaml);
  } catch (error) {
    return { ...empty, error: `The YAML does not parse: ${(error as Error).message}` };
  }
  const steps = new Map(definition.steps.map((s) => [s.id, s]));
  const infos = new Map(definition.steps.map((s) => [s.id, describe(s.type)]));
  const isTouchpoint = (s: StepDefinition) => infos.get(s.id)?.kind === 'client';
  const touchpoints = definition.steps.filter(isTouchpoint).map((s) => touchpointOf(s, infos.get(s.id)!));

  // Flow between touchpoints: from the start and from each touchpoint's events, walk the steps until the next
  // touchpoints or the ends, remembering what was passed and the last branch taken.
  const flow = new Map<string, MapFlowEdge>();
  const ends = new Map<string, MapEnd>();
  const start = definition.steps.find((s) => s.type === 'start');
  const origins: Array<{ id: string; step: StepDefinition }> = [
    ...(start ? [{ id: '@start', step: start }] : []),
    ...definition.steps.filter(isTouchpoint).map((s) => ({ id: s.id, step: s })),
  ];
  for (const origin of origins) {
    for (const event of origin.step.events) {
      const seen = new Set<string>();
      const walk = (ids: string[], via: MapViaStep[], branch: string | undefined, depth: number) => {
        for (const id of ids) {
          const step = steps.get(id);
          if (!step || depth > 200) continue;
          if (isTouchpoint(step)) {
            record(step.id, via, branch);
            continue;
          }
          if (seen.has(id)) continue;
          seen.add(id);
          const here = step.type === 'start' ? via : [...via, viaOf(step, infos.get(id) ?? null)];
          const outgoing = step.events.filter((e) => e.next.length);
          if (!outgoing.length) {
            const end = endOf(step);
            ends.set(end.id, end);
            record(end.id, here, branch);
            continue;
          }
          // A branch: events leading to different places (an AI step's extracted / incomplete / failed going to the
          // same next step is not one).
          const branching = new Set(outgoing.map((e) => e.next.join(','))).size > 1;
          for (const next of outgoing) walk(next.next, here, branching ? `${step.name}: ${eventLabel(step, next.name)}` : branch, depth + 1);
        }
      };
      const record = (to: string, via: MapViaStep[], branch: string | undefined) => {
        const key = `${origin.id}|${event.name}|${to}`;
        const existing = flow.get(key);
        if (existing) {
          for (const v of via) if (!existing.via.some((x) => x.stepId === v.stepId)) existing.via.push(v);
          return;
        }
        flow.set(key, { from: origin.id, event: event.name, eventLabel: eventLabel(origin.step, event.name), to, branch, via: [...via] });
      };
      walk(event.next, [], undefined, 0);
    }
  }

  const config = (s: StepDefinition) => (s.config ?? {}) as Record<string, any>;
  return {
    ...empty,
    function: definition.function,
    startOn: definition.startOn,
    stages: definition.stages.map((s) => ({ key: s.key, label: s.label, ...(s.exit ? { exit: true } : {}) })),
    inputs: definition.inputs.map((i: any) => ({ name: String(i.name ?? i.id), label: String(i.label ?? i.name ?? i.id) })),
    outputs: Object.keys(definition.outputs),
    clientVisibility: definition.clientVisibility,
    stepCount: definition.steps.filter((s) => s.type !== 'start').length,
    touchpoints,
    flow: [...flow.values()],
    ends: [...ends.values()],
    people: definition.steps.filter((s) => s.type === 'review' || s.type === 'task').map((s) => ({ stepId: s.id, name: s.name, type: s.type, role: config(s).assignTo?.role ? String(config(s).assignTo.role) : null })),
    calls: definition.steps.flatMap((s): MapWorkflow['calls'] => {
      const fn = FUNCTION_TYPE.exec(s.type);
      if (fn) return [{ stepId: s.id, name: s.name, workflowId: fn[1], kind: 'function', wait: true }];
      if ((s.type === 'workflow.call' || s.type === 'foreach') && /^[0-9a-f-]{36}$/i.test(text(config(s).workflowId))) {
        return [{ stepId: s.id, name: s.name, workflowId: text(config(s).workflowId), kind: s.type === 'foreach' ? 'foreach' : 'call', wait: config(s).wait !== false }];
      }
      return [];
    }),
    forms: definition.steps.filter((s) => s.type === 'form.request' && config(s).formId).map((s) => ({ stepId: s.id, name: s.name, formId: text(config(s).formId) })),
    connectors: definition.steps.filter((s) => s.type.startsWith('connector:')).map((s) => {
      const info = infos.get(s.id);
      const connectorId = info?.connectorId ?? s.type.slice(10).split('/')[0];
      return { stepId: s.id, name: s.name, connectorId, connectorName: info?.connectorName ?? connectorId, component: info?.title ?? s.type, connectionId: text(config(s).connection) || null };
    }),
    notifies: definition.steps.filter((s) => s.type === 'client.notify' && config(s).page && !String(config(s).page).startsWith('=')).map((s) => ({ stepId: s.id, name: s.name, page: text(config(s).page), title: text(config(s).title) })),
    signals: definition.steps.filter((s) => s.type === 'webhook.wait').map((s) => ({ stepId: s.id, name: s.name, signal: text(config(s).name), timeout: config(s).timeout ? text(config(s).timeout) : null })),
  };
}
