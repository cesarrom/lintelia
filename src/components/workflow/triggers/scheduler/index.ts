import { Clock } from "lucide-react";
import { TriggerDefinition } from "../types";
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
