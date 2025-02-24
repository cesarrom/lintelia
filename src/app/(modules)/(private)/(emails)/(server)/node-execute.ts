import OpenAI from 'openai';
import { events, EmailNodeData, EmailNodeDataSchema } from "../types";
import * as restate from "@restatedev/restate-sdk/fetch";
import { getConfiguration, nextOrEndExecution } from "@/lib/restate-utils";
import { env } from '@/lib/constants';
import { inject } from '@/lib/injector/utils';
import { downloadFile } from '../../(shared)/(actions)/files';
import { ExecuteNodeFunctionProps } from '../../(workflows)/types';
import { getInjector } from '@/lib/injector';
import { EmailsService as ES } from '@/lib/services';

export const emailsService = restate.object({
  name: "email",
  handlers: {
    executeNode: async (c: restate.ObjectContext, { executionId, nodeData, yaml, domain, token, result: r }: ExecuteNodeFunctionProps) => {
      try {
        const config = await c.run('validate-config', async () => {
          return EmailNodeDataSchema.parse(nodeData.config || {});
        });

        const variables = await getConfiguration(c, executionId, config, r) as EmailNodeData;

        const injector = await getInjector(domain);
        const emailService = injector.resolve(ES);

        await emailService.sendEmailTemplate({
          to: variables.to,
          templateId: variables.emailTemplateId,
          variables: variables.inputs,
          cc: variables.cc,
        });


        return await nextOrEndExecution(c, { nodeData, event: events.success, executionId, globalResult: r, localResult: {}, yaml, domain, token });

      } catch (error) {
        return await nextOrEndExecution(c, { nodeData, event: events.failed, executionId, globalResult: r, localResult: {}, yaml, domain, token });
      }
    },
  }
});

export type EmailsService = typeof emailsService;