export interface HttpHeader {
  id: string; // For list rendering key
  name: string;
  value: string;
}

export interface WebhookEvent {
  id: string; // e.g., 'order.created', 'user.updated'
  name: string; // e.g., 'Order Created', 'User Updated'
  description?: string;
}

export interface OutgoingWebhookConfiguration {
  id: string;
  name: string; // User-friendly name for the webhook
  url: string;
  secretHeaders: HttpHeader[];
  subscribedEvents: string[]; // Array of WebhookEvent ids
  isEnabled: boolean;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}
