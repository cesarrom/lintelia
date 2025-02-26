import { events, FormNodeDataSchema } from "../types";
import * as restate from "@restatedev/restate-sdk/fetch";
import { nextOrEndExecution, getConfiguration } from "@/lib/restate-utils";
import { ExecuteNodeFunctionProps } from "../../(workflows)/types";
import { inject } from "@/lib/injector/utils";
import { FormsService } from "@/lib/services/forms.service";
import { auth } from "@/lib/clients/auth.client";
import assert from "assert";

export const formService = restate.object({
  name: "form",
  handlers: {
    executeNode: async (c: restate.ObjectContext, { executionId, nodeData, yaml, domain, token, result: r }: ExecuteNodeFunctionProps) => {
      // Validate and parse the node configuration
      const config = await c.run('validate-config', async () => {
        return FormNodeDataSchema.parse(nodeData.config || {});
      });

      // Get user information from token
      const info = await c.run('validate-session', () => auth.validateJwt(token));
      assert(info?.token?.sub, 'Valid token is required');

      // Get interpolated variables using the workflow's result
      const variables = await c.run('get-variables', () => {
        return getConfiguration(c, executionId, config.variables || {}, r);
      });

      // Create a form instance with the interpolated variables
      const instance = await c.run('create-instance', async () => {
        const formsService = await inject([FormsService], ({ }, [service]) => service)({ token: token, domain: domain! });

        return formsService.createInstance({
          formId: config.formId,
          variables,
          submittedBy: info.token.sub!,
        });
      });

      // Create the public URL with the instance ID
      
      // Create an awakeable promise that will be resolved when the form is submitted
      const resolvablePromise = c.awakeable<Record<string, unknown>>();

      const publicUrl = `${process.env.NEXT_PUBLIC_URL}/forms/${config.formId}/instances/${instance.id}?promiseId=${resolvablePromise.id}&key=${c.key}`;

      // Emit the public URL event first
      await nextOrEndExecution(c, { 
        nodeData, 
        event: events.publicUrl, 
        executionId, 
        localResult: { url: publicUrl }, 
        globalResult: r, 
        yaml, 
        domain, 
        token 
      });

      // Wait for the form to be submitted
      const formData = await resolvablePromise.promise;

      // Update the form instance with the submitted data
      await c.run('update-instance', async () => {
        const formsService = await inject([FormsService], ({ }, [service]) => service)();
        return formsService.updateInstance(instance.id, {
          answers: formData,
          status: 'submitted'
        });
      });

      // Continue workflow execution with the form data
      return nextOrEndExecution(c, { 
        nodeData, 
        event: events.success, 
        executionId, 
        localResult: formData, 
        globalResult: r, 
        yaml, 
        domain, 
        token 
      });
    },
  }
});

export type FormService = typeof formService;
