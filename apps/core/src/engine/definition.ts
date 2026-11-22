import YAML from 'yaml';

/**
 * Workflow definitions executed by the case engine. Same YAML shape the workflow editor produces
 * (`steps[].events[].next`), plus `startOn` (platform events that start the workflow).
 */
export interface StepEvent {
  name: string;
  next: string[];
}

export interface StepDefinition {
  id: string;
  name: string;
  type: string;
  description?: string;
  config: Record<string, any>;
  events: StepEvent[];
  isTerminal?: boolean;
}

export interface WorkflowDefinition {
  id?: string;
  name: string;
  description: string;
  version: number;
  allowedRoles: string[];
  /** Event types that start the workflow (the types of `startRules`). */
  startOn: string[];
  /**
   * How each event starts it (docs/plans/17 §3.4): `startOn: [api:loan.payment]`, or
   * `startOn: [{ event: api:loan.payment, correlate: { loan: "= data.loanId" } }]` — start-or-deliver: an open case of
   * this workflow holding that key gets the event instead of a new case starting.
   */
  startRules: Array<{ event: string; correlate?: Record<string, string> }>;
  /** Business keys of the case (JSONata or {{templates}} over `input`, `case`, `steps`), kept while it is open. */
  correlation: Record<string, string>;
  /** `requests_only`: the applicant never sees the case itself (e.g. investigations), only requests addressed to them. */
  clientVisibility: 'full' | 'requests_only';
  inputs: Array<{ id: string; name: string; type: string; required?: boolean; label?: string; description?: string }>;
  steps: StepDefinition[];
  /**
   * Business stages of the case (a deal: submitted → underwriting → funding → boarded), set by `case.update` steps;
   * shown on the case, the board and to clients.
   */
  stages: Array<{ key: string; label: string; clientLabel?: string; exit?: boolean }>;
  /**
   * A function: other workflows use it as a step (`function:<workflow id>`) with its inputs as fields and these
   * outputs as the step's result — an institution's own connector, made of steps.
   */
  function: boolean;
  /** What the case returns to its caller: name → JSONata or {{template}} over the case (`steps`, `input`, `case`). */
  outputs: Record<string, string>;
}

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? value as T[] : []);

const stringMap = (value: unknown): Record<string, string> =>
  value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, String(v)])) : {};

function startRulesOf(value: unknown): WorkflowDefinition['startRules'] {
  return asArray<unknown>(value).map((entry) => {
    if (typeof entry === 'string') return { event: entry };
    if (entry && typeof entry === 'object' && typeof (entry as { event?: unknown }).event === 'string') {
      const correlate = stringMap((entry as { correlate?: unknown }).correlate);
      return { event: String((entry as { event: string }).event), ...(Object.keys(correlate).length ? { correlate } : {}) };
    }
    return null;
  }).filter((r): r is { event: string; correlate?: Record<string, string> } => !!r);
}

/**
 * Parsed YAML of recent definitions: versions are immutable and read on every case page, task and engine step, and
 * parsing dominates. Callers get their own copy (structuredClone is far cheaper than parsing).
 */
const parsed = new Map<string, any>();
const MAX_PARSED = 300;
function parseYaml(yaml: string) {
  let raw = parsed.get(yaml);
  if (raw === undefined) {
    raw = YAML.parse(yaml) ?? {};
    if (parsed.size >= MAX_PARSED) parsed.delete(parsed.keys().next().value!);
    parsed.set(yaml, raw);
  }
  return structuredClone(raw);
}

export function parseDefinition(yaml: string): WorkflowDefinition {
  const raw = parseYaml(yaml);
  return {
    id: raw.id,
    name: String(raw.name ?? 'Untitled workflow'),
    description: String(raw.description ?? ''),
    version: Number(raw.version ?? 1),
    allowedRoles: asArray<string>(raw.allowedRoles),
    startRules: startRulesOf(raw.startOn),
    startOn: startRulesOf(raw.startOn).map((r) => r.event),
    correlation: stringMap(raw.correlation),
    clientVisibility: raw.clientVisibility === 'requests_only' ? 'requests_only' : 'full',
    inputs: asArray(raw.inputs),
    stages: asArray<any>(raw.stages).filter((s) => s && s.key).map((s) => ({ key: String(s.key), label: String(s.label ?? s.key), ...(s.clientLabel ? { clientLabel: String(s.clientLabel) } : {}), ...(s.exit ? { exit: true } : {}) })),
    function: raw.function === true,
    outputs: raw.outputs && typeof raw.outputs === 'object' && !Array.isArray(raw.outputs) ? Object.fromEntries(Object.entries(raw.outputs).map(([k, v]) => [k, String(v)])) : {},
    steps: asArray<any>(raw.steps).map((step) => ({
      id: String(step.id),
      name: String(step.name ?? step.id),
      type: String(step.type),
      description: step.description,
      config: step.config ?? {},
      isTerminal: step.isTerminal,
      events: asArray<any>(step.events).map((event) => ({ name: String(event.name), next: asArray<string>(event.next).map(String) })),
    })),
  };
}

/** Title of a case created on a version: the definition's `caseTitle` template, or "<workflow name>: <applicant>". */
export function renderCaseTitle(yaml: string, data: Record<string, unknown>, applicantLabel: string, interpolateFn: (t: string, v: Record<string, unknown>) => string): string {
  const raw = parseYaml(yaml);
  const template = typeof raw.caseTitle === 'string' ? raw.caseTitle : `${raw.name ?? 'Case'}: {{applicant}}`;
  return interpolateFn(template, { input: data, applicant: applicantLabel }).slice(0, 255);
}
