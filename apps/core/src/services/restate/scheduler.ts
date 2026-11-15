
import { type ObjectContext, object } from "@restatedev/restate-sdk/fetch";
import { addMinutes, addHours, addDays, addWeeks, addMonths, addYears, differenceInSeconds } from "date-fns";
import { ExecuteNodeFunctionProps } from "../../utils/restate-utils";
import { WorkflowExecutionsService } from "../../services/workflow-executions.service";
import { SchedulerNodeConfig, schedulerNodeConfigSchema, WORKFLOW_EVENTS } from "@repo/fintivio/schemas";
import { RestateService } from "./restate.abstract.service";
import { Scope, Injectable, Inject } from "@nestjs/common";

@Injectable({
  scope: Scope.REQUEST
})
export class SchedulerService extends RestateService<'scheduler'> {
  object = object({
    name: "scheduler",
    handlers: {
      executeNode: async (c: ObjectContext, { executionId, nodeData, workflowId, domain, token, result: r }: ExecuteNodeFunctionProps) => {
        const config = await c.run('validate-config', async () => {
          return schedulerNodeConfigSchema.parse(nodeData.config || {});
        });

        const variables = this.workflowExecutionsService.getConfiguration(config, r) as SchedulerNodeConfig;

        const sleepValue = await c.run('sleep-value', () => {
          let targetDate: Date;

          if (variables.type === 'absolute') {
            targetDate = new Date(variables.scheduledDate);
          } else {
            const now = new Date();
            switch (variables.unit) {
              case 'minutes':
                targetDate = addMinutes(now, variables.amount);
                break;
              case 'hours':
                targetDate = addHours(now, variables.amount);
                break;
              case 'days':
                targetDate = addDays(now, variables.amount);
                break;
              case 'weeks':
                targetDate = addWeeks(now, variables.amount);
                break;
              case 'months':
                targetDate = addMonths(now, variables.amount);
                break;
              case 'years':
                targetDate = addYears(now, variables.amount);
                break;
              default:
                throw new Error(`Unsupported time unit: ${variables.unit}`);
            }
          }
          return targetDate.getTime();
        });

        const sleepSeconds = differenceInSeconds(new Date(sleepValue), new Date());

        if (sleepSeconds > 0) {
          await c.sleep(sleepSeconds);
        }

        return this.workflowExecutionsService.nextOrEndExecution(c, { nodeId: nodeData.id, event: WORKFLOW_EVENTS.scheduler.done, executionId, globalResult: r, localResult: {}, workflowId, domain, token });
      },
    },
  });

  constructor(
    @Inject(WorkflowExecutionsService) private workflowExecutionsService: WorkflowExecutionsService,
  ) {
    super();
  }
}