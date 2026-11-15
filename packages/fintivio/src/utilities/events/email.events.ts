import { createEvent } from './create-event';
import { EmailTemplate, LogCategory, LogLevel, TriggerDefinition } from '../../schemas';
import { EntityType, BaseEventData, ListenerConfig } from './types';

/**
 * Base interface for all email-related events
 */
interface BaseEmailEventData extends BaseEventData {
  // The user who triggered the event
  userId: string;
  // The tenant this event belongs to
  tenantId: string;
  // Index signature to allow additional properties
  [key: string]: unknown;
}

/**
 * Email sending events
 */
export interface EmailSentEvent extends BaseEmailEventData {
  // The email addresses this email was sent to
  to: string[];
  // The ID of the template used for this email
  templateId: string;
  // The status of the email
  status: 'sent' | 'delivered' | 'bounced' | 'opened' | 'clicked';
  // Optional message ID from the email service
  messageId?: string;
  // Optional subject of the email
  subject?: string;
  // Optional metadata about the email
  metadata?: Record<string, unknown>;
}

/**
 * Email template events
 */
export interface EmailTemplateEvent extends BaseEmailEventData {
  // The ID of the template
  templateId: string;
  // The name of the template
  name: string;
  // Optional description of the template
  description?: string;
  // Optional category for the template
  category?: string;
}

/**
 * Configuration for email event listeners
 */
export interface EmailListenerConfig<T extends BaseEmailEventData> extends Omit<ListenerConfig<T>, 'where' | 'entityType' | 'entityId'> {
  // Filter by template ID
  templateId?: string | string[] | RegExp;
  // Filter by recipient email address
  recipient?: string | string[] | RegExp;
  // Filter by tenant ID
  tenantId?: string | string[];
  // Additional custom filters
  where?: Partial<T>;
}

/**
 * Creates an email event with proper entity references
 */
function createEmailEvent<T extends BaseEmailEventData>(
  name: string, 
  category: LogCategory, 
  level: LogLevel,
) {
  return createEvent<T>({
    name,
    category,
    level,
    source: 'email-service',
  });
}

/**
 * Creates an email event with proper entity references
 */
function createEmailTemplateEvent<T extends BaseEmailEventData>(
  name: string, 
  category: LogCategory, 
  level: LogLevel,
) {
  return createEvent<EmailTemplate, ListenerConfig<T>>({
    name,
    category,
    level,
    source: 'email-service',
  });
}

export const EmailEvents = {
  // Email Sending
  EmailSent: createEmailEvent<EmailSentEvent>(
    'email.sent',
    'integration' as LogCategory,
    'info' as LogLevel
  ),
  
  EmailDelivered: createEmailEvent<EmailSentEvent>(
    'email.delivered',
    'integration' as LogCategory,
    'info' as LogLevel
  ),
  
  EmailOpened: createEmailEvent<EmailSentEvent>(
    'email.opened',
    'integration' as LogCategory,
    'info' as LogLevel
  ),
  
  // Email Templates
  TemplateCreated: createEmailTemplateEvent<EmailTemplateEvent>(
    'email.template.created',
    'integration' as LogCategory,
    'info' as LogLevel
  ),
  
  TemplateUpdated: createEmailTemplateEvent<EmailTemplateEvent & { changes: Record<string, unknown> }>(
    'email.template.updated',
    'integration' as LogCategory,
    'info' as LogLevel
  ),
  
  TemplateDeleted: createEmailTemplateEvent<EmailTemplateEvent>(
    'email.template.deleted',
    'integration' as LogCategory,
    'warning' as LogLevel
  ),
} as const;

/**
 * Helper function to create a listener for email events
 */
export function createEmailListener<T extends BaseEmailEventData>(
  event: {
    createListener: (config: ListenerConfig<T>, workflowId: string) => TriggerDefinition;
  },
  config: EmailListenerConfig<T>,
  workflowId: string
): TriggerDefinition {
  // Extract the where clause from the config
  const { where: configWhere = {}, ...restConfig } = config;
  
  // Create the where clause with templateId and tenantId if provided
  const where: Partial<T> = { ...configWhere };
  
  // Add templateId and tenantId to the where clause if provided
  const whereWithExtras = {
    ...where,
    ...(config.templateId && { templateId: config.templateId }),
    ...(config.tenantId && { tenantId: config.tenantId })
  } as T;

  // Create the listener config with proper typing
  const listenerConfig: ListenerConfig<T> = {
    ...restConfig,
    where: whereWithExtras,
    // Default to email template entity type if not specified
    entityType: EntityType.EMAIL_TEMPLATE,
  };

  return event.createListener(listenerConfig, workflowId);
}
