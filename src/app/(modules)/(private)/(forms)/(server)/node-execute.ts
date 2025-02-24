

import { events, FormNodeDataSchema } from "../types";
import * as restate from "@restatedev/restate-sdk/fetch";
import { nextOrEndExecution } from "@/lib/restate-utils";
import { ExecuteNodeFunctionProps } from "../../(workflows)/types";

export const formService = restate.object({
  name: "form",
  handlers: {
    executeNode: async (c: restate.ObjectContext, { executionId, nodeData, yaml, domain, token, result: r }: ExecuteNodeFunctionProps) => {
      const config = await c.run('validate-config', async () => {
        return FormNodeDataSchema.parse(nodeData.config || {});
      });

      const resolvablePromise = c.awakeable<Record<string, unknown>>();

      const publicUrl = `${process.env.NEXT_PUBLIC_URL}/forms/${config.formId}?promiseId=${resolvablePromise.id}`;

      await nextOrEndExecution(c, { nodeData, event: events.publicUrl, executionId, localResult: { url: publicUrl }, globalResult: r, yaml, domain, token });

      const formData = await resolvablePromise.promise;

      return nextOrEndExecution(c, { nodeData, event: events.success, executionId, localResult: formData, globalResult: r, yaml, domain, token });
    },
    resolvePromise: async (c: restate.ObjectContext, { promiseId, data }: { promiseId: string, data: Record<string, unknown> }) => {
      await c.resolveAwakeable(promiseId, data);
      return true;
    },
  }
});

export type FormService = typeof formService;
