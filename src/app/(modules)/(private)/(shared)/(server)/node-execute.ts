

import * as restate from "@restatedev/restate-sdk/fetch";

export const resolvableService = restate.object({
  name: "resolvable",
  handlers: {
   resolve: async (c: restate.ObjectContext, { promiseId, data }: { promiseId: string, data: Record<string, unknown> }) => {
      await c.resolveAwakeable(promiseId, data);
      return true;
    },
  }
});

export type ResolvableService = typeof resolvableService;