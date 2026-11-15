import { type ObjectContext, object } from "@restatedev/restate-sdk/fetch";
import { FormsService } from "../../services/forms.service";
import { auth } from "../../clients/auth.client";
import assert from "assert";
import { env } from "../../constants";
import { WorkflowExecutionsService } from "../../services/workflow-executions.service";
import { formNodeConfigSchema, type User, WORKFLOW_EVENTS, UpdateFormRequest, CreateReviewRequest, FormInstance, SubmitFormAnswersRequest, GenerateFormAIRequest, CreateFormRequest, CreateTestFormInstanceRequest } from "@repo/fintivio/schemas";
import { ExecuteNodeFunctionProps } from "../../utils/restate-utils";
import { TriggerBuilder } from "@repo/fintivio/utilities";
import OpenAI from 'openai';
import { LogsService } from "../../services/logs.service";
import { ReviewsService } from "../../services/reviews.service";
import { RestateService } from "./restate.abstract.service";
import { prompts } from "../../prompts/prompt";
import { USER } from "../../injector/tokens/user.token";
import { Inject, Scope, Injectable } from "@nestjs/common";

@Injectable({
  scope: Scope.REQUEST
})
export class FormService extends RestateService<'form'> {
  object = object({
    name: "form",
    handlers: {
      executeNode: async (c: ObjectContext, args: ExecuteNodeFunctionProps) => {
        const { executionId, nodeData, workflowId, domain, token, result: r, resumableId, resumableResult } = args;
        // Validate and parse the node configuration
        const config = await c.run('validate-config', async () => {
          return formNodeConfigSchema.parse(nodeData.config || {});
        });

        // Get user information from token
        const info = await c.run('validate-session', () => auth.validateJwt(token));
        assert(info?.token?.sub, 'Valid token is required');

        // Get interpolated variables using the workflow's result
        const variables = await c.run('get-variables', () => {
          return this.workflowExecutionsService.getConfiguration(config.variables || {}, r);
        });

        if (!resumableId) {
          // Create a form instance with the interpolated variables
          const instance = await c.run('create-instance', async () => {
            return this.formsService.createInstance({
              formId: config.formId,
              variables,
              submittedBy: info.token.sub!,
            });
          });


          const resumeResult = { form_id: config.formId, instance_id: instance.id };

          // Create a resumable that when triggered, calls this same node again, hopefully with resumableId and resumableResult
          const resumable = await this.workflowExecutionsService.createResumable(
            c,
            {
              ...args,
              event: args.sourceEvent,
              localResult: resumeResult,
              nextNodes: [nodeData],
              globalResult: r,
              nodeId: nodeData.id
            },
            new TriggerBuilder(instance.id!)
              .matchMessage('Form answers submitted')
              .matchCategory('form')
              .matchLevel('info')
              .matchMetadata(['metadata', 'instanceId'], instance.id),
            {
              instanceId: '{{metadata.instanceId}}',
              answerId: '{{metadata.answerId}}',
              formId: '{{metadata.formId}}'
            }
          );

          const publicUrl = `https://${domain}.${env.DOMAIN}/forms/${config.formId}/instances/${instance.id}/answers/new?resumableId=${resumable}`;

          const localResult = { url: publicUrl, form_id: config.formId, instance_id: instance.id };

          // Emit the public URL event first
          return await this.workflowExecutionsService.nextOrEndExecution(c, {
            nodeId: nodeData.id,
            event: WORKFLOW_EVENTS.form.publicUrl,
            executionId,
            localResult,
            globalResult: r,
            workflowId,
            domain,
            token
          });
        }

        const { instanceId, answerId, formId } = resumableResult as { instanceId: string, answerId: string, formId: string }
        const instanceIdRef = instanceId;

        if (!instanceIdRef) {
          throw new Error('Instance ID is required');
        }

        if (!instanceId || !answerId || !formId) {
          throw new Error('Form data is required');
        }

        // Update the form instance with the submitted data
        await c.run('update-instance', async () => {
          await this.formsService.updateInstance(instanceIdRef, {
            status: 'submitted'
          });
        });

        const answers = await c.run('get-answers', async () => {
          return this.formsService.getAnswer(answerId);
        });

        // Continue workflow execution with the form data
        return await this.workflowExecutionsService.nextOrEndExecution(c, {
          nodeId: nodeData.id,
          event: WORKFLOW_EVENTS.form.success,
          executionId,
          localResult: { ...(answers?.value || {}), form_id: config.formId, instance_id: instanceId, answers_id: answerId },
          globalResult: r,
          workflowId,
          domain,
          token
        });
      },
      generateFormWithAI: async (c: ObjectContext, { prompt, existingConfig }: GenerateFormAIRequest) => {
        const openai = new OpenAI({
          apiKey: env.OPENAI_API_KEY,
        });

        const messages = [
          { role: 'system', content: prompts.FORM_GENERATION_PROMPT },
          { role: 'user', content: prompt }
        ];

        if (existingConfig) {
          messages.push({
            role: 'assistant',
            content: `Current form configuration: ${JSON.stringify(existingConfig, null, 2)}`
          });
        }

        try {
          const chatCompletion = await openai.chat.completions.create({
            messages: messages as any,
            model: 'gpt-4-turbo-preview',
            temperature: 0.7,
            response_format: { type: "json_object" }
          });

          const reply = chatCompletion.choices[0].message.content;
          return { result: JSON.parse(reply || '{}') };
        } catch (error: any) {
          return { error: error.message || 'Failed to generate form configuration' };
        }
      },
      createForm: async (c: ObjectContext, data: CreateFormRequest) => {
        const result = await this.formsService.create({
          ...data,
          createdBy: this.user!.userId,
        });

        return { ...result };
      },
      updateForm: async (c: ObjectContext, { data, id }: UpdateFormRequest) => {
        const result = await this.formsService.update(id, data);


        return { ...result };
      },
      listForms: async (c: ObjectContext, search?: string) => {
        const results = await this.formsService.list(search);
        return results.map(form => ({ ...form }));
      },
      getFormById: async (c: ObjectContext, id: string) => {
        const result = await this.formsService.getById(id);
        return result ? { ...result } : null;
      },
      getFormInstances: async (c: ObjectContext, formId: string): Promise<FormInstance[]> => {
        const instances = await this.formsService.listInstances(formId);
        return instances.map(instance => ({ ...instance }));
      },
      getFormInstance: async (c: ObjectContext, instanceId: string) => {
        const instance = await this.formsService.getInstance(instanceId);
        if (!instance) throw new Error('Form instance not found');
        return { ...instance };
      },
      createTestFormInstance: async (c: ObjectContext, { formId, variables = {} }: CreateTestFormInstanceRequest) => {
        const instance = await this.formsService.createInstance({
          formId,
          variables,
          submittedBy: this.user!.userId,
        });

        return { ...instance };
      },
      submitFormAnswers: async (c: ObjectContext, { instanceId, answers }: SubmitFormAnswersRequest) => {
        const instance = await this.formsService.getInstance(instanceId);

        if (!instance) throw new Error('Form instance not found');

        // Create form answers
        const formAnswer = await this.formsService.createAnswers({
          formId: instance.formId, // Using instanceId as formId since we're saving to the instance
          instanceId,
          answers,
        });

        // Update instance status to submitted
        await this.formsService.updateInstance(instanceId, {
          answers,
          status: 'submitted'
        });

        // Log the activity
        await this.logsService.create({
          message: 'Form answers submitted',
          category: 'form',
          level: 'info',
          metadata: {
            instanceId,
            answerId: formAnswer.id,
            formId: instance.formId,
            submittedBy: this.user?.userId || 'system'
          }
        });

        return formAnswer;
      },
      getAnswers: async (c: ObjectContext, { instanceId }: { instanceId: string }) => {
        const answers = await this.formsService.getAnswers(instanceId);
        return answers;
      }
    }
  });

  constructor(
    @Inject(FormsService) private formsService: FormsService,
    @Inject(WorkflowExecutionsService) private workflowExecutionsService: WorkflowExecutionsService,
    @Inject(LogsService) private logsService: LogsService,
    @Inject(USER) private user: User,
  ) {
    super();
  }
}
