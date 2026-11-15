import { type ObjectContext, object } from "@restatedev/restate-sdk/fetch";
import { WorkflowExecutionsService } from "../../services/workflow-executions.service";
import { ExecuteNodeFunctionProps } from "../../utils/restate-utils";
import { RestateService } from "./restate.abstract.service";
import { Inject, Scope, Injectable } from "@nestjs/common";

@Injectable({
  scope: Scope.REQUEST
})
export class EndService extends RestateService<'end'> {
  object = object({
    name: "end",  
    handlers: {
      executeNode: async (c: ObjectContext, { executionId, nodeData, workflowId, domain, token, result: r }: ExecuteNodeFunctionProps) => {
        const eventName = nodeData?.exports?.[0]?.event || 'done';
        // Emit the public URL event first
        return this.workflowExecutionsService.nextOrEndExecution(c, {
          nodeId: nodeData.id,
          event: eventName,
          executionId,
          localResult: {},
          globalResult: r,
          workflowId,
          domain,
          token
        });
      },
    }
  });

  constructor(
    @Inject(WorkflowExecutionsService) private workflowExecutionsService: WorkflowExecutionsService,
  ) {
    super();
  }
}
