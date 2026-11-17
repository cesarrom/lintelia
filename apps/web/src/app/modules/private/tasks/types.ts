export interface TaskOutcome {
  key: string;
  label: string;
  requiresReason?: boolean;
  needsSecondApproval?: boolean;
}

export interface TaskSummary {
  id: string;
  caseId: string;
  stepId: string;
  audience: 'member' | 'client';
  kind: string;
  title: string;
  description: string | null;
  status: string;
  queue: { role: string } | null;
  assignee: { id: string; email: string | null } | null;
  authority: 'standard' | 'high';
  outcomes: TaskOutcome[];
  dueAt: string | null;
  escalatedAt: string | null;
  firstDecision: { outcome: string; by: string; byEmail: string; reason?: string; at: string } | null;
  decision: string | null;
  decisionReason: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  requestItems: Array<{ key: string; label: string; type: string }> | null;
  response: Record<string, unknown> | null;
  parentTaskId: string | null;
  createdAt: string;
  case?: { id: string; reference: string; title: string; status: string; applicantEmail: string | null; applicantName: string | null; riskLevel: string | null };
}

export interface Calculation {
  step: string;
  name: string;
  values: Record<string, unknown>;
}

export interface TaskDetail extends TaskSummary {
  caseData: Record<string, unknown>;
  calculations: Calculation[];
  /** The case's documents. */
  files?: Array<{ id: string; name: string; size: number; contentType: string; source: string; createdAt: string; scan: string | null; sanitization: string[] }>;
}
