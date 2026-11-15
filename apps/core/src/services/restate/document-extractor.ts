import OpenAI from 'openai';
import { type ObjectContext, object } from "@restatedev/restate-sdk/fetch";
import { env } from '../../constants';
import assert from 'assert';
import { WorkflowExecutionsService } from '../../services/workflow-executions.service';
import { FormsService } from '../../services/forms.service';
import { DocumentExtractorNodeConfig, documentExtractorNodeConfigSchema, type Tenant, type User, WORKFLOW_EVENTS } from '@repo/fintivio/schemas';
import { FilesService } from '../files.service';
import { ExecuteNodeFunctionProps } from '../../utils/restate-utils';
import { RestateService } from './restate.abstract.service';
import { prompts } from '../../prompts/prompt';
import { USER } from '../../injector/tokens/user.token';
import { TENANT } from '../../injector/tokens/tenant.token';
import { Inject, Scope, Injectable } from "@nestjs/common";

@Injectable({
  scope: Scope.REQUEST
})
export class DocumentExtractorService extends RestateService<'documentExtractor'> {
  object = object({
    name: "documentExtractor",
    handlers: {
      executeNode: async (c: ObjectContext, { executionId, nodeData, workflowId, domain, token, result: r }: ExecuteNodeFunctionProps) => {
        assert(this.user, 'User is required');
        assert(this.tenant, 'Tenant is required');

        const configRef = await c.run('validate-config', () => {
          return documentExtractorNodeConfigSchema.parse(nodeData.config || {});
        });

        const config = this.workflowExecutionsService.getConfiguration(configRef, r) as DocumentExtractorNodeConfig;

        const { file: fileId } = config

        const openai = new OpenAI({
          apiKey: env.OPENAI_API_KEY,
        });

        const file = await this.filesService.downloadWithMetadataFile(fileId as string);

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
            return this.formsService.createFormWithAnswers(
              {
                name: 'Proof of Life',
                description: '',
                createdBy: this.user?.userId || 'System',
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

          return this.workflowExecutionsService.nextOrEndExecution(c, { nodeId: nodeData.id, event: WORKFLOW_EVENTS.documentExtractor.failure, executionId, globalResult: r, localResult: { error: result.error, form_id: form.id, instance_id: instance.id, answer_id: answer.id }, workflowId, domain, token });
        }

        const { form, instance, answer } = await c.run('create-form-with-answers', async () => {
          return this.formsService.createFormWithAnswers(
            {
              name: 'Proof of Life',
              description: '',
              createdBy: this.user?.userId || 'System',
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

        return this.workflowExecutionsService.nextOrEndExecution(c, { nodeId: nodeData.id, event: WORKFLOW_EVENTS.documentExtractor.success, executionId, globalResult: r, localResult: { ...result, form_id: form.id, instance_id: instance.id, answer_id: answer.id }, workflowId, domain, token });
      },
    }
  });

  constructor(
    @Inject(WorkflowExecutionsService) private workflowExecutionsService: WorkflowExecutionsService,
    @Inject(FormsService) private formsService: FormsService,
    @Inject(FilesService) private filesService: FilesService,
    @Inject(USER) private user: User,
    @Inject(TENANT) private tenant: Tenant
  ) {
    super();
  }
}