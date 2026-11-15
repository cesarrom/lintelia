import { relations } from "drizzle-orm/relations";
import { sysWorkflows, sysWorkflowExecutions, sysWorkflowNodeExecutions, sysWorkflowExecutionListeners, sysWorkflowTriggers, sysForms, sysFormInstances, sysFormAnswers, sysReviews, sysWorkflowNodeExecutionsEdges } from "./schema";

export const sysWorkflowExecutionsRelations = relations(sysWorkflowExecutions, ({one, many}) => ({
	sysWorkflow: one(sysWorkflows, {
		fields: [sysWorkflowExecutions.workflowId],
		references: [sysWorkflows.id]
	}),
	sysWorkflowNodeExecutions: many(sysWorkflowNodeExecutions),
	sysWorkflowExecutionListeners: many(sysWorkflowExecutionListeners),
}));

export const sysWorkflowsRelations = relations(sysWorkflows, ({many}) => ({
	sysWorkflowExecutions: many(sysWorkflowExecutions),
	sysWorkflowTriggers: many(sysWorkflowTriggers),
}));

export const sysWorkflowNodeExecutionsRelations = relations(sysWorkflowNodeExecutions, ({one, many}) => ({
	sysWorkflowExecution: one(sysWorkflowExecutions, {
		fields: [sysWorkflowNodeExecutions.executionId],
		references: [sysWorkflowExecutions.id]
	}),
	sysWorkflowNodeExecution: one(sysWorkflowNodeExecutions, {
		fields: [sysWorkflowNodeExecutions.previousNodeExecutionId],
		references: [sysWorkflowNodeExecutions.id],
		relationName: "sysWorkflowNodeExecutions_previousNodeExecutionId_sysWorkflowNodeExecutions_id"
	}),
	sysWorkflowNodeExecutions: many(sysWorkflowNodeExecutions, {
		relationName: "sysWorkflowNodeExecutions_previousNodeExecutionId_sysWorkflowNodeExecutions_id"
	}),
	sysReviews: many(sysReviews),
	sysWorkflowNodeExecutionsEdges: many(sysWorkflowNodeExecutionsEdges),
}));

export const sysWorkflowExecutionListenersRelations = relations(sysWorkflowExecutionListeners, ({one}) => ({
	sysWorkflowExecution: one(sysWorkflowExecutions, {
		fields: [sysWorkflowExecutionListeners.executionId],
		references: [sysWorkflowExecutions.id]
	}),
}));

export const sysWorkflowTriggersRelations = relations(sysWorkflowTriggers, ({one}) => ({
	sysWorkflow: one(sysWorkflows, {
		fields: [sysWorkflowTriggers.workflowId],
		references: [sysWorkflows.id]
	}),
}));

export const sysFormInstancesRelations = relations(sysFormInstances, ({one, many}) => ({
	sysForm: one(sysForms, {
		fields: [sysFormInstances.formId],
		references: [sysForms.id]
	}),
	sysFormAnswers: many(sysFormAnswers),
}));

export const sysFormsRelations = relations(sysForms, ({many}) => ({
	sysFormInstances: many(sysFormInstances),
}));

export const sysFormAnswersRelations = relations(sysFormAnswers, ({one}) => ({
	sysFormInstance: one(sysFormInstances, {
		fields: [sysFormAnswers.formInstanceId],
		references: [sysFormInstances.id]
	}),
}));

export const sysReviewsRelations = relations(sysReviews, ({one}) => ({
	sysWorkflowNodeExecution: one(sysWorkflowNodeExecutions, {
		fields: [sysReviews.nodeExecutionId],
		references: [sysWorkflowNodeExecutions.id]
	}),
}));

export const sysWorkflowNodeExecutionsEdgesRelations = relations(sysWorkflowNodeExecutionsEdges, ({one}) => ({
	sysWorkflowNodeExecution: one(sysWorkflowNodeExecutions, {
		fields: [sysWorkflowNodeExecutionsEdges.nodeExecutionId],
		references: [sysWorkflowNodeExecutions.id]
	}),
}));