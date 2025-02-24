import OpenAI from 'openai';
import { events } from "../types";
import * as restate from "@restatedev/restate-sdk/fetch";
import { nextOrEndExecution } from "@/lib/restate-utils";
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
    
    Do not include any additional text or explanations in your response.
  `,
};

export const documentExtractorService = restate.object({
  name: "documentExtractor",
  handlers: {
    executeNode: async (c: restate.ObjectContext, { executionId, nodeData, yaml, domain, token, result: r }: ExecuteNodeFunctionProps) => {
      const resolvablePromise = c.awakeable<string>();

      const publicUrl = `${process.env.NEXT_PUBLIC_URL}/document-extractor?promiseId=${resolvablePromise.id}`;

      await nextOrEndExecution(c, { nodeData, event: events.publicUrl, executionId, globalResult: r, localResult: { url: publicUrl }, yaml, domain, token });

      const fileId = await resolvablePromise.promise;

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
      const result = JSON.parse(reply || '{}');

      return nextOrEndExecution(c, { nodeData, event: events.success, executionId, globalResult: r, localResult: result, yaml, domain, token });
    },
  }
});

export type DocumentExtractorService = typeof documentExtractorService;