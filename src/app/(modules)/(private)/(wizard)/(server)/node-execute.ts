

import { events } from "../types";
import * as restate from "@restatedev/restate-sdk/fetch";
import { nextOrEndExecution } from "@/lib/restate-utils";
import { ExecuteNodeFunctionProps } from "../../(workflows)/types";

export const wizardService = restate.object({
  name: "wizard",
  handlers: {
    executeNode: async (c: restate.ObjectContext, { executionId, nodeData, yaml, domain, token, result: r }: ExecuteNodeFunctionProps) => {
      return nextOrEndExecution(c, { nodeData, event: events.end, executionId, globalResult: r, localResult: {}, yaml, domain, token });
    }
  }
});

export type WizardService = typeof wizardService;