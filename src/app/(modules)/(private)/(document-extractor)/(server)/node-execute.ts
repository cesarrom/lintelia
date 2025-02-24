import OpenAI from 'openai';
import { DocumentExtractorNodeData, DocumentExtractorNodeDataSchema, events } from "../types";
import * as restate from "@restatedev/restate-sdk/fetch";
import { getConfiguration, nextOrEndExecution } from "@/lib/restate-utils";
import { env } from '@/lib/constants';
import { inject } from '@/lib/injector/utils';
import { downloadFile } from '../../(shared)/(actions)/files';
import { ExecuteNodeFunctionProps } from '../../(workflows)/types';

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

    if there are any errors, return a { error: string } with a human readable error message.
    
    Do not include any additional text or explanations in your response.
  `,
};

export const documentExtractorService = restate.object({
  name: "documentExtractor",
  handlers: {
    executeNode: async (c: restate.ObjectContext, { executionId, nodeData, yaml, domain, token, result: r }: ExecuteNodeFunctionProps) => {
      const configRef = await c.run('validate-config', () => {
        return DocumentExtractorNodeDataSchema.parse(nodeData.config || {});
      });

      const config = await getConfiguration(c, executionId, configRef, r) as DocumentExtractorNodeData;

      const { file: fileId } = config

      const openai = new OpenAI({
        apiKey: env.OPENAI_API_KEY,
      });

      const file = await downloadFile(fileId as string);

      const chatCompletion = await openai.chat.completions.create({
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompts.ID_DOCUMENTS,
              },
              {
                type: 'image_url',
                image_url: {
                  url: file.Body,
                  detail: 'auto',
                },
              },
            ],
          }
        ],
        model: 'gpt-4-vision-preview',
        stream: false,
      });

      const reply = chatCompletion.choices[0].message.content;
      const result = JSON.parse(reply || '{ "error": "No response from OpenAI" }');

      if (result.error) {
        return nextOrEndExecution(c, { nodeData, event: events.failure, executionId, globalResult: r, localResult: { error: result.error }, yaml, domain, token });
      }

      return nextOrEndExecution(c, { nodeData, event: events.success, executionId, globalResult: r, localResult: result, yaml, domain, token });
    },
  }
});

export type DocumentExtractorService = typeof documentExtractorService;