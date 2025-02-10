import { Wallet } from "lucide-react";
import { TriggerDefinition } from "../types";
import { TransactionsConfig } from "./TransactionsConfig";
import { EventContext } from "@/types/schema";

interface TransactionTriggerConfig {
  userId?: string;
  accountId?: string;
  minAmount?: number;
  maxAmount?: number;
  currency?: string;
  type?: "credit" | "debit" | "both";
  status?: "pending" | "completed" | "failed";
}

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

export const transactionsTrigger: TriggerDefinition<TransactionTriggerConfig> = {
  name: "Transactions",
  description: "Trigger workflow execution when a transaction occurs",
  icon: Wallet,
  configComponent: TransactionsConfig,
  initialConfig: {
    type: "both",
    status: "completed",
  },

  async shouldExecute(context: EventContext, config: TransactionTriggerConfig) {
    const payload = context.payload as TransactionPayload;

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
  },

  async getEventData(context: EventContext) {
    const payload = context.payload as TransactionPayload;
    
    return {
      transaction: {
        id: payload.id,
        userId: payload.userId,
        accountId: payload.accountId,
        amount: payload.amount,
        currency: payload.currency,
        type: payload.type,
        status: payload.status,
        description: payload.description,
        metadata: payload.metadata,
        createdAt: payload.createdAt,
      },
      timestamp: new Date().toISOString(),
    };
  },
};
