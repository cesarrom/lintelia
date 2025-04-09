import { events, EmailNodeData, EmailNodeDataSchema } from "../types";
import * as restate from "@restatedev/restate-sdk/fetch";
import { ExecuteNodeFunctionProps } from "@/app/(modules)/(private)/(workflows)/types";
import { EmailsService as ES } from '@/lib/services';
import { workflowInject } from '@/lib/injector/utils';
import { WorkflowExecutionsService } from '@/lib/services';

export const emailsService = restate.object({
  name: "email",
  handlers: {
    executeNode: workflowInject(
      [ES, WorkflowExecutionsService],
      async ({}, [emailService, workflowExecutionsService], c: restate.ObjectContext, { executionId, nodeData, yaml, domain, token, result: r }: ExecuteNodeFunctionProps) => {
        try {
          const config = await c.run('validate-config', async () => {
            return EmailNodeDataSchema.parse(nodeData.config || {});
          });

          const variables = workflowExecutionsService.getConfiguration(config, r) as EmailNodeData;

          await emailService.sendEmailTemplate({
            to: variables.to,
            subject: variables.subject,
            template: variables.template,
            cc: variables.cc,
          });


          return await workflowExecutionsService.nextOrEndExecution({ nodeData, event: events.success, executionId, globalResult: r, localResult: {}, yaml, domain, token });

        } catch (error) {
          return await workflowExecutionsService.nextOrEndExecution({ nodeData, event: events.failed, executionId, globalResult: r, localResult: {}, yaml, domain, token });
        }
      }
    ),
  }
});

export type EmailsService = typeof emailsService;