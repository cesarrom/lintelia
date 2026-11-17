import type { AppDefinition, Institution } from '@/client-app/types';

/** `GET /experience-map` (apps/core/src/experience-map). */
export interface MapField { key: string; label: string; type: string; required: boolean; options?: Array<{ value: string; label: string }>; placeholder?: string; default?: string; help?: string; optionsFrom?: string; visibleIf?: string; width?: string }

export interface MapTouchpoint {
  stepId: string;
  kind: 'screen' | 'request' | 'form' | 'action' | 'parties';
  name: string;
  title: string;
  description?: string;
  content?: string;
  stage?: string;
  fields: MapField[];
  buttons: Array<{ key: string; label: string; style: string }>;
  items: Array<{ key: string; label: string; type: string }>;
  formId?: string;
  connector?: { id: string; name: string; component: string };
  events: Array<{ key: string; label: string }>;
  autoSubmit?: { button: string; when: string; delay?: number };
}

export interface MapViaStep {
  stepId: string;
  name: string;
  type: string;
  group: 'people' | 'connector' | 'function' | 'workflow' | 'signal' | 'notify' | 'auto';
  detail?: string;
  asksClient?: boolean;
}

export interface MapFlowEdge { from: string; event: string; eventLabel: string; to: string; branch?: string; via: MapViaStep[] }
export interface MapEnd { id: string; status: string; outcome: string | null; label: string }

export interface MapWorkflow {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'draft';
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

export interface MapForm { id: string; name: string; description: string | null; workflowId: string | null; published: boolean; publicKey: string | null }

export interface MapData {
  institution: Institution;
  app: { exists: boolean; name: string | null; activeVersion: number | null; definition: AppDefinition; errors: string[] };
  workflows: MapWorkflow[];
  forms: MapForm[];
  connections: Array<{ id: string; connectorId: string; name: string; status: string }>;
}
