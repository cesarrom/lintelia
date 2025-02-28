'use server';

import { revalidatePath } from 'next/cache';
import { inject } from '@/lib/injector/utils';
import { LogsService } from '@/lib/services';
import { LogsFilter } from '@/lib/services/logs.service';

// List logs with optional filtering
export const getLogs = inject(
  [LogsService],
  async (context, [logsService], filter?: LogsFilter) => {
    const logs = await logsService.list(filter);
    revalidatePath('/logs');
    return logs;
  }
);

// Get a single log by ID
export const getLog = inject(
  [LogsService],
  async (context, [logsService], id: string) => {
    return await logsService.getById(id);
  }
);

// Create a new log entry
export const createLog = inject(
  [LogsService],
  async (context, [logsService], data: {
    message: string;
    details?: string;
    level?: 'info' | 'warning' | 'error' | 'debug';
    category?: 'system' | 'workflow' | 'user' | 'form' | 'security' | 'integration';
    source?: string;
    userId?: string;
    metadata?: Record<string, any>;
  }) => {
    const log = await logsService.create(data);
    revalidatePath('/logs');
    return log;
  }
);

// Acknowledge a log
export const acknowledgeLog = inject(
  [LogsService],
  async (context, [logsService], id: string, userId: string) => {
    const success = await logsService.acknowledge(id, userId);
    revalidatePath('/logs');
    return success;
  }
);

// Delete a log
export const deleteLog = inject(
  [LogsService],
  async (context, [logsService], id: string) => {
    const success = await logsService.delete(id);
    revalidatePath('/logs');
    return success;
  }
);

// Delete logs older than a specific date
export const deleteOldLogs = inject(
  [LogsService],
  async (context, [logsService], date: Date) => {
    const success = await logsService.deleteOlderThan(date);
    revalidatePath('/logs');
    return success;
  }
);