import { FormConfig } from "./forms.schema";
import { Tenant } from "./globals.schema";
import { LogCategory, LogLevel } from "./shared.schema";
import { Log } from "./tenants.schema";
import { ColumnDefinition, NodeData, ValueType, WorkflowValue } from "./workflows.schema";

export type GetTablesResponse = { name: string; columns: ColumnDefinition[] }
export type GenerateFormAIRequest = { prompt: string, existingConfig?: FormConfig };
export type CreateFormRequest = { name: string, description?: string, config: FormConfig };
export type UpdateFormRequest = { id: string, data: { name?: string, description?: string, config?: FormConfig } };
export type CreateTestFormInstanceRequest = { formId: string, variables?: Record<string, unknown> };
export type SubmitFormAnswersRequest = { instanceId: string, answers: Record<string, unknown> };

export interface CreateFormAnswersInput {
  formId: string;
  instanceId: string;
  answers: Record<string, any>;
}

export interface CreateFormInput {
  name: string;
  description?: string;
  config: FormConfig;
  createdBy: string;
}

export interface UpdateFormInput {
  name?: string;
  description?: string;
  config?: FormConfig;
}

export interface CreateFormInstanceInput {
  formId: string;
  variables: Record<string, unknown>;
  submittedBy: string;
}

export interface UpdateFormInstanceInput {
  answers?: Record<string, any>;
  status?: "draft" | "submitted";
  variables?: Record<string, unknown>;
}

export type CreateReviewRequest = {
  title: string;
  description?: string;
  reviewItems: Array<{ answer_id: string }>;
  nodeExecutionId: string;
};


export interface CreateLogRequest {
  message: string;
  details?: string;
  level?: LogLevel;
  category?: LogCategory;
  source?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface LogsFilterRequest {
  startDate?: Date;
  endDate?: Date;
  level?: LogLevel;
  category?: LogCategory;
  source?: string;
  userId?: string;
  acknowledged?: boolean;
  search?: string;
}

export interface LogsAnalyticsResponse {
  totalCount: number;
  byLevel: Record<LogLevel, number>;
  byCategory: Record<LogCategory, number>;
  bySource: Record<string, number>;
  byUser: Record<string, number>;
  timeDistribution: Array<{
    date: string;
    count: number;
    byLevel: Record<LogLevel, number>;
  }>;
  topErrors: Log[];
  recentActivity: Log[];
}

export type AcknowledgeLogRequest = { id: string, userId: string };

export type TopUserLogsResponse = { userId: string; count: number };

export type TopSourceLogsResponse = { source: string; count: number };

export type LogTrendsResponse = { date: string; count: number; byLevel: Record<LogLevel, number> }

export interface TenantDomainSetupRequest {
  tenantDomains: string[];
}

export interface CNAMERecordResponse {
  Name: string;
  Type: string;
  Value: string;
}


export interface CreateEmailTemplateRequest {
  name: string;
  description?: string;
  subject: string;
  body: string;
  variables: Record<string, WorkflowValue>;
  createdBy: string;
}

export interface UpdateEmailTemplateRequest {
  name?: string;
  description?: string;
  subject?: string;
  body?: string;
  variables?: Record<string, WorkflowValue>;
}


export interface SendEmailRequest {
  to: string;
  subject: string;
  text: string;
  html?: string;
  cc?: string[];
}

export interface SendTemplateRequest {
  to: string;
  subject: string;
  template: string;
  cc?: string[];
}

export interface CreateKeyValueInput {
  key: string;
  value: string;
  description?: string;
  createdBy: string;
}

export interface UpdateKeyValueInput {
  value?: string;
  description?: string;
}


export interface CreateReviewInput {
  title: string;
  description?: string;
  reviewItems: Array<{
    answer_id: string;
    label?: string;
  }>;
  assignToUser?: string;
  dueDate?: Date;
}

export interface UpdateReviewInput {
  status?: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'additional_data_requested';
  comments?: string;
  rejectionReason?: string;
  additionalDataRequest?: string;
  reviewItems?: Array<{
    answer_id: string;
    status: 'pending' | 'approved' | 'rejected';
    comments?: string;
  }>;
  evidence?: Array<{
    type: string;
    url: string;
    name: string;
    description?: string;
  }>;
}

export interface ReviewsFilter {
  status?: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'additional_data_requested';
  assignedTo?: string;
  fromDate?: Date;
  toDate?: Date;
} 

export interface AuthRole {
  name: string;
  description?: string;
  permissionNames?: string[];
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserRoleInput {
  userId: string;
  roleId: string;
  tenantId?: string
}

export interface UserInput {
  userId: string;
  tenantId?: string
}

export interface CreateSystemVariableInput {
  name: string;
  description: string;
  type: ValueType;
  value: any;
  isProtected?: boolean;
}

export interface UpdateSystemVariableInput {
  name?: string;
  description?: string;
  value?: any;
  isProtected?: boolean;
}

export type CreateTenant = Omit<
  Tenant,
  'id' | 'status' | 'createdAt' | 'updatedAt'
> & {
  /** People invited when the tenant is created. The first `admin` invitee becomes the tenant's administrator. */
  invitee: Array<{ email: string; role: string }>;
};

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  picture?: string;
  roles: string[];
  /** How each role was given (docs/plans/15): `manual`, `idp` (groups), `default` (just in time), `recovery` (staff). */
  assignments?: Array<{ role: string; source: string; groups: string[]; expiresAt: Date | string | null }>;
  /** Roles come from the identity provider for this member (SSO domain, role source `idp`). */
  managedByIdp?: boolean;
  attributes?: Record<string, unknown>;
  kind?: 'member' | 'client';
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface InviteUserInput {
  email: string;
  name: string;
  roleIds: string[];
  loginId?: string;
}


export type NextNodeOrExecutionArgs = StandardNodeArgs & {
  nextNodes?: NodeData[],
  executionId: string,
  localResult: Record<string, unknown>,
  globalResult: Record<string, unknown>,
  domain: string,
  token: string,
  resumableId?: string,
  resumableResult?: Record<string, unknown>,
};

export type StandardNodeArgs = {
  workflowId: string,
  nodeId: string;
  event: string;
}

export type ForceNextNodeArgs = {
  forceExecution: string[];
}

export type ResumableArgs = NextNodeOrExecutionArgs & { maxCalls: number }

export interface SaveWorkflowInput {
  yaml: string;
  createdBy: string;
}

export interface UpdateWorkflowInput {
  yaml: string;
}

export interface SaveTriggerInput {
  workflowId: string;
  name: string;
  type: string;
  eventName: string;
  config: Record<string, unknown>;
  createdBy: string;
}

export interface UpdateTriggerInput {
  name: string;
  type: string;
  eventName: string;
  config: Record<string, unknown>;
  status: 'active' | 'inactive';
}

export type StartWorkflowRequest = { variables: Record<string, unknown>, yaml: string, token: string, domain: string, workflowId: string, result: Record<string, unknown> };

export type TriggerWorkflowRequest = { variables: Record<string, unknown>, workflowId: string, token: string, domain: string, result: Record<string, unknown> };

export type ResumeWorkflowRequest = { resumableId: string, domain: string, token: string, result: object, workflowId: string };

export type SaveWorkflowRequest = { workflowId?: string, yaml: string };

export type SetWorkflowStatusRequest = { workflowId: string, status: 'draft' | 'active' | 'archived' };

export type UpdateUserRolesRequest = { userId: string, roleIds: string[] };

export type DeleteTenantRequest = { userId: string, domain: string };

export type GetTenantRequest = { domain?: string };

export type GetTenantDatabaseRequest = { domain: string };


export type CreateRoleRequest = { name: string; description: string; permissions: string[] }

export type UpdateRoleRequest = { id: string, data: { name?: string; description?: string; permissions?: string[] } };

export type GetReviewsRequest = {
  status?: string;
  assignedTo?: string;
  fromDate?: string;
  toDate?: string;
};

export type UpdateReviewsRequest = {
  id: string,
  data: UpdateReviewInput,
  userId?: string
};

export type ApproveReviewRequest = {
  id: string, data: {
    comments?: string;
    reviewItems: Array<{
      answer_id: string;
      status: 'approved' | 'rejected';
      comments?: string;
    }>;
  }
}

export type RejectReviewRequest = {
  id: string, data: {
    rejectionReason: string;
    comments?: string;
    reviewItems: Array<{
      answer_id: string;
      status: 'approved' | 'rejected';
      comments?: string;
    }>;
    evidence?: Array<{
      type: string;
      url: string;
      name: string;
      description?: string;
    }>;
  }
};

export type RequestAdditionalDataRequest = {
  id: string, data: {
    additionalDataRequest: string;
    comments?: string;
  }
};

export type CreateTenantResponse = Tenant & {
  cnameRecords: CNAMERecordResponse[];
  /** E-mails that were sent an invitation. */
  invitations?: string[];
}

// --- AuthService DTOs ---
export interface VerifyIdentityPersonInput {
  givenName: string;
  familyName: string;
  primaryEmail: string;
  primaryPhone: string;
}

export interface VerifyIdentityRequest {
  person: VerifyIdentityPersonInput;
}

export interface VerifyIdentityResponse {
  verificationRequired: boolean;
  continuation?: string;
}

export interface AfterLoginRequest {
  firstSeen: boolean;
}

export interface AfterLoginResponse {
  redirectPath: string;
}

export type UpdateTenantRequest = {
  domain: string;
  data: Partial<Tenant>;
}