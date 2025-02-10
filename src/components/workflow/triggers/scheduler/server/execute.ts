import { EventContext } from "@/types/schema";

interface SchedulerEventPayload {
  schedule: string;
  timestamp: number;
}

interface SchedulerTriggerConfig {
  schedule: string; // Cron expression
  timezone?: string;
}

export async function shouldExecute(event: EventContext<SchedulerEventPayload>, config: SchedulerTriggerConfig) {
  const payload = event.payload;

  // Check if the schedule matches
  if (payload.schedule !== config.schedule) {
    return false;
  }

  // Additional timezone checks could be added here if needed
  if (config.timezone) {
    // Convert timestamps to the specified timezone and compare
    // This is a placeholder for timezone-specific logic
  }

  return true;
}

export async function execute(event: EventContext<SchedulerEventPayload>) {
  return {
    success: true,
    outputs: {
      schedule: event.payload.schedule,
      timestamp: event.payload.timestamp,
      executedAt: new Date().toISOString(),
    },
  };
} 