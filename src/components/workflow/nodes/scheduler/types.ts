export type TimeUnit = 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years';

export type ScheduleType = 'absolute' | 'relative';

export interface SchedulerNodeData {
  type: ScheduleType;
  // For absolute scheduling
  scheduledDate?: string; // Expression that evaluates to a date string
  // For relative scheduling
  amount?: string; // Expression that evaluates to a number
  unit?: TimeUnit;
  // Optional settings
  settings?: {
    retryOnFailure?: boolean;
    maxRetries?: number;
    retryDelay?: number; // in seconds
    timezone?: string;
  };
}; 