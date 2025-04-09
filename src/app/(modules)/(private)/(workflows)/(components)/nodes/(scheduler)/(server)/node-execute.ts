
import { events, SchedulerNodeData, SchedulerNodeDataSchema } from "../types";
import * as restate from "@restatedev/restate-sdk/fetch";
import { addMinutes, addHours, addDays, addWeeks, addMonths, addYears, differenceInSeconds } from "date-fns";
import { ExecuteNodeFunctionProps } from "@/app/(modules)/(private)/(workflows)/types";
import { workflowInject } from "@/lib/injector/utils";
import { WorkflowExecutionsService } from "@/lib/services";

export const schedulerService = restate.object({
  name: "scheduler",
  handlers: {
    executeNode: workflowInject(
      [WorkflowExecutionsService],
      async ({}, [workflowExecutionsService], c: restate.ObjectContext, { executionId, nodeData, yaml, domain, token, result: r }: ExecuteNodeFunctionProps) => {
        const config = await c.run('validate-config', async () => {
          return SchedulerNodeDataSchema.parse(nodeData.config || {});
        });

        const variables = workflowExecutionsService.getConfiguration(config, r) as SchedulerNodeData;

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

        return workflowExecutionsService.nextOrEndExecution({ nodeData, event: events.done, executionId, globalResult: r, localResult: {}, yaml, domain, token });
      }
    ),
  },
});

export type SchedulerService = typeof schedulerService;