import { z } from 'zod';
import { createSelectSchema } from 'drizzle-zod';
import { sysEmailTemplates } from '../entities/tenant/email-template.entity.js';
import { sysFormAnswers } from '../entities/tenant/form-answer.entity.js';
import { sysForms } from '../entities/tenant/form.entity.js';
import { sysInvitations } from '../entities/tenant/invitation.entity.js';
import { sysKeyValues } from '../entities/tenant/key-value.entity.js';
import { sysLogs } from '../entities/tenant/log.entity.js';
import { sysReviews } from '../entities/tenant/review.entity.js';
import { sysSystemTriggers } from '../entities/tenant/system-trigger.entity.js';
import { sysSystemVariables } from '../entities/tenant/system-variable.entity.js';
import { sysWorkflowExecutions } from '../entities/tenant/workflow-execution.entity.js';
import { sysWorkflows } from '../entities/tenant/workflow.entity.js';
import { sysFormInstances } from '../entities/tenant/form-instance.entity.js';
import { sysWorkflowTriggers } from '../entities/tenant/workflow-trigger.entity.js';
import { sysDocumentTemplates } from '../entities/tenant/document-template.entity.js';
import { sysDocuments } from '../entities/tenant/document.entity.js';

export const emailTemplateSchema = createSelectSchema(sysEmailTemplates);

export type EmailTemplate = typeof sysEmailTemplates.$inferInsert

export const formAnswerSchema = createSelectSchema(sysFormAnswers);

export type FormAnswer = typeof sysFormAnswers.$inferInsert

export const formSchema = createSelectSchema(sysForms);

export type Form = typeof sysForms.$inferInsert

export const formInstanceSchema = createSelectSchema(sysFormInstances);

export type FormInstance = typeof sysFormInstances.$inferInsert;

export const invitationSchema = createSelectSchema(sysInvitations);

export type Invitation = typeof sysInvitations.$inferInsert;

export const keyValueSchema = createSelectSchema(sysKeyValues);

export type KeyValue = typeof sysKeyValues.$inferInsert;

export const logSchema = createSelectSchema(sysLogs);

export type Log = typeof sysLogs.$inferInsert;

export const reviewSchema = createSelectSchema(sysReviews);

export type Review = typeof sysReviews.$inferInsert

export const systemTriggerSchema = createSelectSchema(sysSystemTriggers);

export type SystemTrigger = typeof sysSystemTriggers.$inferInsert;

export const systemVariableSchema = createSelectSchema(sysSystemVariables);

export type SystemVariable = typeof sysSystemVariables.$inferInsert;

export const workflowExecutionSchema = createSelectSchema(sysWorkflowExecutions);

export type WorkflowExecution = typeof sysWorkflowExecutions.$inferInsert

export const workflowSchema = createSelectSchema(sysWorkflows);

export type Workflow = typeof sysWorkflows.$inferInsert;

export const workflowTriggerSchema = createSelectSchema(sysWorkflowTriggers);

export type WorkflowTrigger = typeof sysWorkflowTriggers.$inferInsert;

export const documentTemplateSchema = createSelectSchema(sysDocumentTemplates);

export type DocumentTemplate = typeof sysDocumentTemplates.$inferInsert;

export const documentSchema = createSelectSchema(sysDocuments);

export type Document = typeof sysDocuments.$inferInsert;


