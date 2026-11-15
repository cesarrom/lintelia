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

export const emailTemplateSchema = createSelectSchema(sysEmailTemplates);

export type EmailTemplate = z.infer<typeof emailTemplateSchema>;

export const formAnswerSchema = createSelectSchema(sysFormAnswers);

export type FormAnswer = z.infer<typeof formAnswerSchema>;

export const formSchema = createSelectSchema(sysForms);

export type Form = z.infer<typeof formSchema>;

export const invitationSchema = createSelectSchema(sysInvitations);

export type Invitation = z.infer<typeof invitationSchema>;

export const keyValueSchema = createSelectSchema(sysKeyValues);

export type KeyValue = z.infer<typeof keyValueSchema>;

export const logSchema = createSelectSchema(sysLogs);

export type Log = z.infer<typeof logSchema>;

export const reviewSchema = createSelectSchema(sysReviews);

export type Review = z.infer<typeof reviewSchema>;

export const systemTriggerSchema = createSelectSchema(sysSystemTriggers);

export type SystemTrigger = z.infer<typeof systemTriggerSchema>;

export const systemVariableSchema = createSelectSchema(sysSystemVariables);

export type SystemVariable = z.infer<typeof systemVariableSchema>;

export const workflowExecutionSchema = createSelectSchema(sysWorkflowExecutions);

export type WorkflowExecution = z.infer<typeof workflowExecutionSchema>;

export const workflowSchema = createSelectSchema(sysWorkflows);

export type Workflow = z.infer<typeof workflowSchema>

