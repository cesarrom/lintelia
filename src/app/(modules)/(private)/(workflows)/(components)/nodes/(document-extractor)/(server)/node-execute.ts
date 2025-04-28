import OpenAI from 'openai';
import { DocumentExtractorNodeData, DocumentExtractorNodeDataSchema, events } from "../types";
import * as restate from "@restatedev/restate-sdk/fetch";
import { env } from '@/lib/constants';
import { ExecuteNodeFunctionProps } from "@/app/(modules)/(private)/(workflows)/types";
import { downloadFile } from '@/app/(modules)/(private)/(shared)/(actions)/files';
import { workflowInject } from '@/lib/injector/utils';
import { FormsService, WorkflowExecutionsService } from '@/lib/services';
import assert from 'assert';

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
    executeNode: workflowInject(
      [WorkflowExecutionsService, FormsService],
      async ({ user, tenant }, [workflowExecutionsService, formsService], c: restate.ObjectContext, { executionId, nodeData, yaml, domain, token, result: r }: ExecuteNodeFunctionProps) => {
        assert(user, 'User is required');
        assert(tenant, 'Tenant is required');

        const configRef = await c.run('validate-config', () => {
          return DocumentExtractorNodeDataSchema.parse(nodeData.config || {});
        });

        const config = workflowExecutionsService.getConfiguration(configRef, r) as DocumentExtractorNodeData;

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
          model: 'gpt-4o',
          response_format: {
            type: 'json_object'
          },
          stream: false,
        });

        const reply = chatCompletion.choices[0].message.content;
        const result = JSON.parse(reply || '{ "error": "No response from OpenAI" }');

        const formId = c.rand.uuidv4();



        if (result.error) {
          const { form, instance, answer } = await c.run('create-form-with-answers', async () => {
            return formsService.createFormWithAnswers(
              {
                name: 'Proof of Life',
                description: '',
                createdBy: user?.userId || 'System',
                config: {
                  id: formId,
                  name: 'Proof of Life',
                  description: '',
                  variables: {},
                  components: [
                    {
                      id: 'error',
                      type: 'text',
                      config: {
                        type: 'text',
                        propertyName: 'error',
                        label: 'Error',
                        required: true,
                        description: '',
                        validation: {},
                        placeholder: ''
                      }
                    },
                  ],
                },
              },
              {
                error: result.error
              }
            );
          });

          return workflowExecutionsService.nextOrEndExecution({ nodeData, event: events.failure, executionId, globalResult: r, localResult: { error: result.error, form_id: form.id, instance_id: instance.id, answer_id: answer.id }, yaml, domain, token });
        }

        const { form, instance, answer } = await c.run('create-form-with-answers', async () => {
          return formsService.createFormWithAnswers(
            {
              name: 'Proof of Life',
              description: '',
              createdBy: user?.userId || 'System',
              config: {
                id: formId,
                name: 'Proof of Life',
                description: '',
                variables: {},
                components: [
                  {
                    id: 'documentNumber',
                    type: 'text',
                    config: {
                      type: 'text',
                      propertyName: 'documentNumber',
                      label: 'Document Number',
                      required: true,
                      description: '',
                      validation: {},
                      placeholder: ''
                    }
                  },
                  {
                    id: 'documentCountryIso',
                    type: 'text',
                    config: {
                      type: 'text',
                      propertyName: 'documentCountryIso',
                      label: 'Document Country ISO',
                      required: true,
                      description: '',
                      validation: {},
                      placeholder: ''
                    }
                  },
                  {
                    id: 'documentCountryIso3',
                    type: 'text',
                    config: {
                      type: 'text',
                      propertyName: 'documentCountryIso3',
                      label: 'Document Country ISO3',
                      required: true,
                      description: '',
                      validation: {},
                      placeholder: ''
                    }
                  },
                  {
                    id: 'nationalityIso',
                    type: 'text',
                    config: {
                      type: 'text',
                      propertyName: 'nationalityIso',
                      label: 'Nationality ISO',
                      required: true,
                      description: '',
                      validation: {},
                      placeholder: ''
                    }
                  },
                  {
                    id: 'nationalityIso3',
                    type: 'text',
                    config: {
                      type: 'text',
                      propertyName: 'nationalityIso3',
                      label: 'Nationality ISO3',
                      required: true,
                      description: '',
                      validation: {},
                      placeholder: ''
                    }
                  },
                  {
                    id: 'firstName',
                    type: 'text',
                    config: {
                      type: 'text',
                      propertyName: 'firstName',
                      label: 'First Name',
                      required: true,
                      description: '',
                      validation: {},
                      placeholder: ''
                    }
                  },
                  {
                    id: 'lastName',
                    type: 'text',
                    config: {
                      type: 'text',
                      propertyName: 'lastName',
                      label: 'Last Name',
                      required: true,
                      description: '',
                      validation: {},
                      placeholder: ''
                    }
                  },
                  {
                    id: 'sex',
                    type: 'text',
                    config: {
                      type: 'text',
                      propertyName: 'sex',
                      label: 'Sex',
                      required: true,
                      description: '',
                      validation: {},
                      placeholder: ''
                    }
                  },
                  {
                    id: 'type',
                    type: 'text',
                    config: {
                      type: 'text',
                      propertyName: 'type',
                      label: 'Type',
                      required: true,
                      description: '',
                      validation: {},
                      placeholder: ''
                    }
                  },
                  {
                    id: 'expirationDate',
                    type: 'date',
                    config: {
                      type: 'date',
                      propertyName: 'expirationDate',
                      label: 'Expiration Date',
                      required: true,
                      description: '',
                      validation: {},
                      placeholder: ''
                    }
                  }
                ],
              },
            },
            {
              documentNumber: result.documentNumber,
              documentCountryIso: result.documentCountryIso,
              documentCountryIso3: result.documentCountryIso3,
              nationalityIso: result.nationalityIso,
              nationalityIso3: result.nationalityIso3,
              firstName: result.firstName,
              lastName: result.lastName,
              sex: result.sex,
              type: result.type,
              expirationDate: result.expirationDate
            }
          );
        });

        return workflowExecutionsService.nextOrEndExecution({ nodeData, event: events.success, executionId, globalResult: r, localResult: { ...result, form_id: form.id, instance_id: instance.id, answer_id: answer.id }, yaml, domain, token });
      }
    ),
  }
});

export type DocumentExtractorService = typeof documentExtractorService;