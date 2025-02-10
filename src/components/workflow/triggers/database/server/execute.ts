import { EventContext } from "@/types/schema";

interface DatabaseEventPayload {
  table: string;
  record: Record<string, unknown>;
  previousRecord?: Record<string, unknown>;
}

interface DatabaseCondition {
  field: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "startsWith" | "endsWith";
  value: string | number | boolean;
}

interface DatabaseTriggerConfig {
  table: string;
  events: string[];
  conditions?: DatabaseCondition[];
}

// Helper to evaluate a single condition
function evaluateCondition(record: Record<string, unknown>, condition: DatabaseCondition): boolean {
  const value = record[condition.field];
  if (value === undefined) return false;

  switch (condition.operator) {
    case "eq":
      return value === condition.value;
    case "neq":
      return value !== condition.value;
    case "gt":
      return typeof value === "number" && value > Number(condition.value);
    case "gte":
      return typeof value === "number" && value >= Number(condition.value);
    case "lt":
      return typeof value === "number" && value < Number(condition.value);
    case "lte":
      return typeof value === "number" && value <= Number(condition.value);
    case "contains":
      return String(value).includes(String(condition.value));
    case "startsWith":
      return String(value).startsWith(String(condition.value));
    case "endsWith":
      return String(value).endsWith(String(condition.value));
    default:
      return false;
  }
}

export async function shouldExecute(event: EventContext<DatabaseEventPayload>, config: DatabaseTriggerConfig) {
  // Check if the event is for the configured table
  if (event.payload.table !== config.table) {
    return false;
  }

  // Check if the event type matches any of the configured events
  if (!config.events.includes(event.eventName)) {
    return false;
  }

  // Check conditions if any are configured
  if (config.conditions?.length > 0) {
    // For updates, check both current and previous record
    if (event.eventName === "record.updated" && event.payload.previousRecord) {
      // Check if any condition matches either the current or previous record
      const currentRecordMatches = config.conditions.every(condition => 
        evaluateCondition(event.payload.record, condition)
      );
      const previousRecordMatches = config.conditions.every(condition => 
        evaluateCondition(event.payload.previousRecord, condition)
      );
      return currentRecordMatches || previousRecordMatches;
    }

    // For other events, just check the current record
    return config.conditions.every(condition => 
      evaluateCondition(event.payload.record, condition)
    );
  }

  return true;
}

export async function execute(event: EventContext<DatabaseEventPayload>) {
  // The execution context will be created by the workflow execution service
  // This trigger doesn't need any special execution logic
  return {
    success: true,
    outputs: {
      table: event.payload.table,
      record: event.payload.record,
      previousRecord: event.payload.previousRecord,
      event: event.eventName,
    },
  };
} 