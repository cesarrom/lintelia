import type { Calculation, TaskSummary } from '../tasks/types';

export interface CaseSummary {
  id: string;
  reference: string;
  title: string;
  status: string;
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

export interface CaseDetail extends CaseSummary {
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
