

import { type ObjectContext, object } from "@restatedev/restate-sdk/fetch";
import { ExecuteNodeFunctionProps } from "../../utils/restate-utils";
import { WorkflowExecutionsService } from "../../services/workflow-executions.service";
import { WORKFLOW_EVENTS } from "@repo/fintivio/schemas";
import { RestateService } from "./restate.abstract.service";
import { Scope, Injectable, Inject } from "@nestjs/common";

@Injectable({
  scope: Scope.REQUEST
})
export class WizardService extends RestateService<'wizard'> {
  object = object({
    name: "wizard",
    handlers: {
      executeNode: async (c: ObjectContext, { executionId, nodeData, workflowId, domain, token, result: r }: ExecuteNodeFunctionProps) => {
        return this.workflowExecutionsService.nextOrEndExecution(c, { nodeId: nodeData.id, event: WORKFLOW_EVENTS.wizard.end, executionId, globalResult: r, localResult: {}, workflowId, domain, token });
      },
    }
  });

  constructor(
    @Inject(WorkflowExecutionsService) private workflowExecutionsService: WorkflowExecutionsService,
  ) {
    super();
  }
}
  