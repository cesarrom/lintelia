import { type ObjectContext, object } from "@restatedev/restate-sdk/fetch";
import { EmailsService } from '../../services/emails.service';
import { WorkflowExecutionsService } from '../../services/workflow-executions.service';
import { ExecuteNodeFunctionProps } from "../../utils/restate-utils";
import { EmailNodeConfig, emailNodeConfigSchema, WORKFLOW_EVENTS } from "@repo/fintivio/schemas";
import { RestateService } from "./restate.abstract.service";
import { Inject, Scope, Injectable } from "@nestjs/common";

@Injectable({
  scope: Scope.REQUEST
})
export class EmailService extends RestateService<'email'> {
  object = object({
    name: "email",
    handlers: {
      executeNode: async (c: ObjectContext, { executionId, nodeData, workflowId, domain, token, result: r }: ExecuteNodeFunctionProps) => {
        try {
          const config = await c.run('validate-config', async () => {
            return emailNodeConfigSchema.parse(nodeData.config || {});
          });

          const variables = await c.run('get-variables', async () => {
            return this.workflowExecutionsService.getConfiguration(config, r) as EmailNodeConfig;
          });

          await c.run('just-send-email', async () => {
            await this.emailService.sendEmailTemplate({
              to: variables.to,
              subject: variables.subject,
              template: variables.template,
              cc: variables.cc,
            });
          });


          return await this.workflowExecutionsService.nextOrEndExecution(c, { nodeId: nodeData.id, event: WORKFLOW_EVENTS.email.success, executionId, globalResult: r, localResult: {}, workflowId, domain, token });

        } catch (error) {
          return await this.workflowExecutionsService.nextOrEndExecution(c, { nodeId: nodeData.id, event: WORKFLOW_EVENTS.email.failed, executionId, globalResult: r, localResult: {}, workflowId, domain, token });
        }
      },
    }
  });

  constructor(
    @Inject(EmailsService) private emailService: EmailsService,
    @Inject(WorkflowExecutionsService) private workflowExecutionsService: WorkflowExecutionsService
  ) {
    super();
  }
}