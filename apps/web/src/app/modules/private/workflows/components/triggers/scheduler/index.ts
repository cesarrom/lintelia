import { TriggerDefinition } from "@repo/fintivio/schemas";
import { Clock } from "lucide-react";
import { SchedulerConfig } from "./SchedulerConfig";

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
