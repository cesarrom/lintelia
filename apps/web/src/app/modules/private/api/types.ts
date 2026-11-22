export interface WebhookEventType {
  type: string;
  description: string;
  schemaVersion: number;
  example: Record<string, unknown>;
}

export interface WebhookSubscription {
  id: string;
  url: string;
  description: string | null;
  eventTypes: string[];
  enabled: boolean;
  failingSince: string | null;
  disabledReason: string | null;
  rotatingUntil: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  eventId: string;
  eventType: string;
  status: 'pending' | 'retrying' | 'delivered' | 'failed';
  attempts: Array<{ at: string; statusCode: number | null; error: string | null; latencyMs: number }>;
  attemptCount: number;
  lastStatusCode: number | null;
  responseExcerpt: string | null;
  nextAttemptAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}
