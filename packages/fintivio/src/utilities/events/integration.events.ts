import { createEvent } from './create-event';
import { LogCategory, LogLevel } from '../../schemas';
import { EntityType, BaseEventData, ListenerConfig } from './types';
import type { JsonValue } from './types';

/**
 * Base interface for all integration-related events
 */
interface BaseIntegrationEventData extends BaseEventData {
  // The ID of the integration this event is related to
  integrationId: string;
  // The ID of the tenant this event belongs to
  tenantId: string;
  // The user who triggered the event (if applicable)
  userId?: string;
  // Additional metadata
  [key: string]: unknown;
}

/**
 * Webhook events
 */
export interface WebhookEventData extends BaseIntegrationEventData {
  // The event type/name
  event: string;
  // The payload received in the webhook
  payload: JsonValue;
  // Optional headers from the webhook request
  headers?: Record<string, string>;
  // Optional HTTP method used for the webhook
  method?: string;
  // Optional path of the webhook URL
  path?: string;
  // Optional query parameters
  query?: Record<string, string>;
  // Status of the webhook processing
  status?: 'received' | 'processing' | 'processed' | 'failed';
  // Error details if processing failed
  error?: string;
  // HTTP status code of the response sent back to the webhook
  statusCode?: number;
  // Time taken to process the webhook in milliseconds
  responseTime?: number;
}

/**
 * API call events
 */
export interface ApiCallEventData extends BaseIntegrationEventData, Omit<Request, 'body'> {
  // The API endpoint that was called
  endpoint: string;
  // The request body
  body?: JsonValue;
  params: object;
}

/**
 * OAuth events
 */
export interface OAuthEventData extends BaseIntegrationEventData {
  // The OAuth provider (e.g., 'google', 'microsoft', 'slack')
  provider: string;
  // The OAuth action (e.g., 'authorize', 'token', 'refresh', 'revoke')
  action: string;
  // The OAuth scopes requested
  scopes?: string[];
  // The user ID of the authenticated user (if available)
  userId?: string;
  // Any error that occurred during the OAuth flow
  error?: string;
  // Additional OAuth parameters
  params?: Record<string, string>;
}

/**
 * Configuration for integration event listeners
 */
export interface IntegrationListenerConfig<T extends BaseIntegrationEventData> 
  extends Omit<ListenerConfig<T>, 'where' | 'entityType' | 'entityId'> {
  // Filter by integration ID
  integrationId?: string | string[] | RegExp;
  // Filter by event type (for webhooks and OAuth events)
  eventType?: string | string[] | RegExp;
  // Filter by status (for webhooks and API calls)
  status?: string | string[] | RegExp;
  // Filter by tenant ID
  tenantId?: string | string[];
  // Additional custom filters
  where?: Partial<T>;
}

/**
 * Creates an integration event with proper entity references
 */
function createIntegrationEvent<T extends BaseIntegrationEventData>(
  name: string, 
  category: LogCategory, 
  level: LogLevel,
  getEntityId: (payload: ApiCallEventData) => { body: object, query: object, params: object } | undefined = (data) => ({ body: data.body as any, query: new URL(data.url!).searchParams!, params: data.params })
) {
  return createEvent<ApiCallEventData, ListenerConfig<T>,  { body: object, query: object, params: object }>({
    name,
    category,
    level,
    source: 'integration-service',
    getEntityRef: getEntityId,
  });
}

export const IntegrationEvents = {
  // Webhook Events
  WebhookReceived: createIntegrationEvent<WebhookEventData>(
    'webhook.received',
    'integration' as LogCategory,
    'info' as LogLevel
  ),
  
  WebhookProcessed: createIntegrationEvent<WebhookEventData & { 
    status: 'success' | 'failed';
  }>(
    'webhook.processed',
    'integration' as LogCategory,
    'info' as LogLevel
  ),
  
  WebhookResponseSent: createIntegrationEvent<WebhookEventData & {
    statusCode: number;
    responseTime: number;
  }>(
    'webhook.response.sent',
    'integration' as LogCategory,
    'debug' as LogLevel
  ),
  
  // API Call Events
  ApiCall: createIntegrationEvent<ApiCallEventData>(
    'api.call',
    'integration' as LogCategory,
    'info' as LogLevel,
  ),
  
  // OAuth Events
  OAuthAuthorize: createIntegrationEvent<OAuthEventData & {
    userId: string;
    scopes: string[];
    success: boolean;
  }>(
    'oauth.authorize',
    'integration' as LogCategory,
    'info' as LogLevel
  ),
  
  OAuthToken: createIntegrationEvent<OAuthEventData & {
    userId: string;
    scopes: string[];
    success: boolean;
  }>(
    'oauth.token',
    'integration' as LogCategory,
    'info' as LogLevel
  ),
  
  OAuthRefresh: createIntegrationEvent<OAuthEventData & {
    userId: string;
    success: boolean;
  }>(
    'oauth.refresh',
    'integration' as LogCategory,
    'info' as LogLevel
  ),
  
  OAuthRevoke: createIntegrationEvent<OAuthEventData & {
    userId: string;
    success: boolean;
  }>(
    'oauth.revoke',
    'integration' as LogCategory,
    'info' as LogLevel
  ),
  
  // Integration Lifecycle Events
  IntegrationEnabled: createIntegrationEvent<BaseIntegrationEventData & {
    name: string;
    type: string;
    userId: string;
  }>(
    'integration.enabled',
    'integration' as LogCategory,
    'info' as LogLevel
  ),
  
  IntegrationDisabled: createIntegrationEvent<BaseIntegrationEventData & {
    name: string;
    type: string;
    userId: string;
  }>(
    'integration.disabled',
    'integration' as LogCategory,
    'info' as LogLevel
  ),
  
  IntegrationUpdated: createIntegrationEvent<BaseIntegrationEventData & {
    name: string;
    type: string;
    userId: string;
    changes: Record<string, unknown>;
  }>(
    'integration.updated',
    'integration' as LogCategory,
    'info' as LogLevel
  ),
};
