import OpenAI from 'openai';
import { events, EmailNodeData, EmailNodeDataSchema } from "../types";
import * as restate from "@restatedev/restate-sdk/fetch";
import { getConfiguration, nextOrEndExecution } from "@/lib/restate-utils";
import { env } from '@/lib/constants';
import { inject } from '@/lib/injector/utils';
import { downloadFile } from '../../(shared)/(actions)/files';
import { ExecuteNodeFunctionProps } from '../../(workflows)/types';
import { getInjector } from '@/lib/injector';
import { EmailsService } from '@/lib/services';

const prompts = {
  ID_DOCUMENTS: `
    Please analyze these ID document images and extract the following information in JSON format.
    
    Return ONLY the JSON object with these fields:
    - documentNumber
    - documentCountryIso (2-letter code) 
    - documentCountryIso3 (3-letter code)
    - nationalityIso (2-letter code)
    - nationalityIso3 (3-letter code)
    - firstName
    - lastName
    - sex (as 'MALE', 'FEMALE', or the actual value)
    - type ('PASSPORT', 'NATIONAL_ID', 'DRIVING_LICENSE', or the actual value)
    - expirationMonth (2 digits)
    - expirationYear (4 digits)
    - expirationDate (in ISO format).
    
    Do not include any additional text or explanations in your response.
  `,
};

export const documentExtractorService = restate.object({
  name: "email",
  handlers: {
    executeNode: async (c: restate.ObjectContext, { executionId, nodeData, yaml, domain, token, result: r }: ExecuteNodeFunctionProps) => {
      try {
        const config = await c.run('validate-config', async () => {
          return EmailNodeDataSchema.parse(nodeData.config || {});
        });

        const variables = await getConfiguration(c, executionId, config, r) as EmailNodeData;

        const injector = await getInjector(domain);
        const emailService = injector.resolve(EmailsService);

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

export type DocumentExtractorService = typeof documentExtractorService;