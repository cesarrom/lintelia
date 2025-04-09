import { Clock } from "lucide-react";
import { SchedulerConfig } from "./SchedulerConfig";
import { TriggerDefinition } from "../../(workflows)/(components)/triggers/types";

export const schedulerTrigger: TriggerDefinition = {
  name: "Scheduler",
  description: "Trigger workflow execution based on a schedule",
  icon: Clock,
  configComponent: SchedulerConfig,
  initialConfig: {
    schedule: "0 0 * * *", // Daily at midnight
    timezone: "UTC",
  },
};
