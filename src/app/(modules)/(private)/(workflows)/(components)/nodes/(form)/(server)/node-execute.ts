import { events, FormNodeDataSchema } from "../types";
import * as restate from "@restatedev/restate-sdk/fetch";
import { ExecuteNodeFunctionProps } from "@/app/(modules)/(private)/(workflows)/types";
import { workflowInject } from "@/lib/injector/utils";
import { FormsService } from "@/lib/services/forms.service";
import { auth } from "@/lib/clients/auth.client";
import assert from "assert";
import { env } from "@/lib/constants";
import { WorkflowExecutionsService } from "@/lib/services/workflow-executions.service";
import { TriggerBuilder } from "@/lib/triggers-utils";

export const formService = restate.object({
  name: "form",
  handlers: {
    executeNode: workflowInject(
      [FormsService, WorkflowExecutionsService],
      async ({ }, [formsService, workflowExecutionsService], c: restate.ObjectContext, args: ExecuteNodeFunctionProps) => {
        const { executionId, nodeData, yaml, domain, token, result: r, resumableId, resumableResult } = args;
        // Validate and parse the node configuration
        const config = await c.run('validate-config', async () => {
          return FormNodeDataSchema.parse(nodeData.config || {});
        });

        // Get user information from token
        const info = await c.run('validate-session', () => auth.validateJwt(token));
        assert(info?.token?.sub, 'Valid token is required');

        // Get interpolated variables using the workflow's result
        const variables = await c.run('get-variables', () => {
          return workflowExecutionsService.getConfiguration(config.variables || {}, r);
        });

        if (!resumableId) {
          // Create a form instance with the interpolated variables
          const instance = await c.run('create-instance', async () => {
            return formsService.createInstance({
              formId: config.formId,
              variables,
              submittedBy: info.token.sub!,
            });
          });


          const resumeResult = { form_id: config.formId, instance_id: instance.id };

          // Create a resumable that when triggered, calls this same node again, hopefully with resumableId and resumableResult
          const resumable = await workflowExecutionsService.createResumable(
            {
              ...args,
              event: args.sourceEvent,
              localResult: resumeResult,
              nextNodes: [nodeData],
              globalResult: r
            },
            new TriggerBuilder(instance.id)
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
          return await workflowExecutionsService.nextOrEndExecution({
            nodeData,
            event: events.publicUrl,
            executionId,
            localResult,
            globalResult: r,
            yaml,
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
          const updatedInstance = await formsService.updateInstance(instanceIdRef, {
            status: 'submitted'
          });
        });

        const answers = await c.run('get-answers', async () => {
          return formsService.getAnswer(answerId);
        });

        // Continue workflow execution with the form data
        return await workflowExecutionsService.nextOrEndExecution({
          nodeData,
          event: events.success,
          executionId,
          localResult: { ...(answers?.value || {}), form_id: config.formId, instance_id: instanceId, answers_id: answerId },
          globalResult: r,
          yaml,
          domain,
          token
        });
      }
    ),
  }
});

export type FormService = typeof formService;
