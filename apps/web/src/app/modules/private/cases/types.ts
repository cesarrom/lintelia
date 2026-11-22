import type { Calculation, TaskSummary } from '../tasks/types';

export interface CaseSummary {
  id: string;
  reference: string;
  title: string;
  status: string;
  /** Business stage set by the workflow (e.g. underwriting, funding). */
  stage: string | null;
  outcome: string | null;
  riskLevel: string | null;
  flags: string[];
  workflow: { id: string; version: number; name: string | null };
  applicant: { id: string | null; email: string | null; name: string | null } | null;
  initiatedBy: { type: string; id: string | null; email: string | null };
  source: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

/** `exit`: off the main path (declined, withdrawn): shown only when the case is there. */
export interface Stage { key: string; label: string; clientLabel?: string; exit?: boolean }

export interface CaseDetail extends CaseSummary {
  /** The workflow's stages, in order. */
  stages: Stage[];
  data: Record<string, unknown>;
  calculations: Calculation[];
  tasks: TaskSummary[];
  decisions: Array<{ taskId: string; step: string; decision: string; by: string; reason: string | null; at: string; stage: 'first_approval' | 'final' }>;
  /** Results connected systems wrote on the case (verifications, signature requests, messages). */
  records?: CaseRecord[];
  parties?: Array<{ id: string; role: string; name: string | null; email: string; status: string; verification: string | null; childCaseId: string | null }>;
  files?: Array<{ id: string; name: string; size: number; contentType: string; source: string; createdAt: string; scan: string | null; sanitization: string[] }>;
}

export interface CaseRecord {
  id: string;
  type: 'verification' | 'signature_request' | 'message' | 'screening_result' | 'document';
  connectorId: string;
  status: string;
  summary: string | null;
  data: Record<string, unknown>;
  history: Array<{ at: string; status: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface CaseSignal {
  id: string;
  /** `signal`: called back by name (`webhook.wait`); `event`: an event about the case's business keys (`event.wait`). */
  kind?: 'signal' | 'event';
  /** Events: the case's keys the event must name (e.g. loan → L-42). */
  keys?: Record<string, string>;
  name: string;
  status: 'waiting' | 'pending' | 'delivered' | 'cancelled';
  source: string | null;
  createdAt: string;
  deliveredAt: string | null;
  fields: string[];
  /** The address to give the other system (waiting signals, for members with cases:signal). */
  hookUrl?: string;
}

export interface Pipeline { id: string; name: string; stages: Stage[]; cases: number }
