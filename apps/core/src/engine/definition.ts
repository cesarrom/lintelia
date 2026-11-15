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
  startOn: string[];
  /** `requests_only`: the applicant never sees the case itself (e.g. investigations), only requests addressed to them. */
  clientVisibility: 'full' | 'requests_only';
  inputs: Array<{ id: string; name: string; type: string; required?: boolean }>;
  steps: StepDefinition[];
}

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? value as T[] : []);

export function parseDefinition(yaml: string): WorkflowDefinition {
  const raw = YAML.parse(yaml) ?? {};
  return {
    id: raw.id,
    name: String(raw.name ?? 'Untitled workflow'),
    description: String(raw.description ?? ''),
    version: Number(raw.version ?? 1),
    allowedRoles: asArray<string>(raw.allowedRoles),
    startOn: asArray<string>(raw.startOn),
    clientVisibility: raw.clientVisibility === 'requests_only' ? 'requests_only' : 'full',
    inputs: asArray(raw.inputs),
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
  const raw = YAML.parse(yaml) ?? {};
  const template = typeof raw.caseTitle === 'string' ? raw.caseTitle : `${raw.name ?? 'Case'}: {{applicant}}`;
  return interpolateFn(template, { input: data, applicant: applicantLabel }).slice(0, 255);
}
