import { EventContext } from "@/types/schema";

interface TransactionPayload {
  id: string;
  userId: string;
  accountId: string;
  amount: number;
  currency: string;
  type: "credit" | "debit";
  status: "pending" | "completed" | "failed";
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface TransactionTriggerConfig {
  userId?: string;
  accountId?: string;
  minAmount?: number;
  maxAmount?: number;
  currency?: string;
  type?: "credit" | "debit" | "both";
  status?: "pending" | "completed" | "failed";
}

export async function shouldExecute(event: EventContext<TransactionPayload>, config: TransactionTriggerConfig) {
  const payload = event.payload;

  // Check user ID if configured
  if (config.userId && payload.userId !== config.userId) {
    return false;
  }

  // Check account ID if configured
  if (config.accountId && payload.accountId !== config.accountId) {
    return false;
  }

  // Check amount range if configured
  if (config.minAmount !== undefined && payload.amount < config.minAmount) {
    return false;
  }
  if (config.maxAmount !== undefined && payload.amount > config.maxAmount) {
    return false;
  }

  // Check currency if configured
  if (config.currency && payload.currency !== config.currency) {
    return false;
  }

  // Check transaction type if configured
  if (config.type && config.type !== "both" && payload.type !== config.type) {
    return false;
  }

  // Check transaction status if configured
  if (config.status && payload.status !== config.status) {
    return false;
  }

  return true;
}

export async function execute(event: EventContext<TransactionPayload>) {
  return {
    success: true,
    outputs: {
      transaction: {
        id: event.payload.id,
        userId: event.payload.userId,
        accountId: event.payload.accountId,
        amount: event.payload.amount,
        currency: event.payload.currency,
        type: event.payload.type,
        status: event.payload.status,
        description: event.payload.description,
        metadata: event.payload.metadata,
        createdAt: event.payload.createdAt,
      },
      timestamp: new Date().toISOString(),
    },
  };
} 