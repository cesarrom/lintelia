import { createEvent } from './create-event';
import { LogCategory, LogLevel, Tenant } from '../../schemas';
import { EntityType, BaseEventData, ListenerConfig } from './types';

/**
 * Base interface for all tenant-related events
 */
interface BaseTenantEventData extends BaseEventData {
  // The ID of the tenant this event belongs to
  tenantId: string;
  // The user who triggered the event (if applicable)
  userId?: string;
  // Additional metadata
  [key: string]: unknown;
}

/**
 * Tenant management events
 */
export interface TenantManagementEventData extends BaseTenantEventData {
  // The name of the tenant
  name: string;
  // The domain of the tenant (if applicable)
  domain?: string;
  // The status of the tenant (active, suspended, etc.)
  status?: string;
}

/**
 * Subscription and billing events
 */
export interface SubscriptionEventData extends BaseTenantEventData {
  // The subscription ID
  subscriptionId: string;
  // The plan ID or name
  plan: string;
  // The billing cycle (monthly, yearly, etc.)
  billingCycle: 'monthly' | 'yearly' | 'custom';
  // The subscription status (active, canceled, past_due, etc.)
  status: string;
  // The subscription amount in the smallest currency unit (e.g., cents)
  amount: number;
  // The currency code (e.g., 'USD', 'EUR')
  currency: string;
  // The billing period start date (ISO 8601)
  periodStart?: string;
  // The billing period end date (ISO 8601)
  periodEnd?: string;
  // Additional subscription details
  metadata?: Record<string, unknown>;
}

/**
 * Invoice events
 */
export interface InvoiceEventData extends BaseTenantEventData {
  // The invoice ID
  invoiceId: string;
  // The subscription ID (if applicable)
  subscriptionId?: string;
  // The invoice number
  number: string;
  // The invoice amount in the smallest currency unit (e.g., cents)
  amount: number;
  // The currency code (e.g., 'USD', 'EUR')
  currency: string;
  // The invoice status (paid, open, void, etc.)
  status: string;
  // The invoice due date (ISO 8601)
  dueDate?: string;
  // The invoice paid date (ISO 8601, if paid)
  paidAt?: string;
  // The invoice PDF URL (if available)
  invoicePdf?: string;
  // Additional invoice details
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for tenant event listeners
 */
export interface TenantListenerConfig<T extends BaseTenantEventData> 
  extends Omit<ListenerConfig<T>, 'where' | 'entityType'> {
  // Filter by tenant ID
  tenantId?: string | string[] | RegExp;
  // Filter by plan (for subscription events)
  plan?: string | string[];
  // Filter by status (for subscription/invoice events)
  status?: string | string[];
  // Filter by billing cycle (for subscription events)
  billingCycle?: 'monthly' | 'yearly' | 'custom' | string[];
  // Additional custom filters
  where?: Partial<T>;
}

/**
 * Creates a tenant event with proper entity references
 */
function createTenantEvent<T extends BaseTenantEventData>(
  name: string, 
  category: LogCategory, 
  level: LogLevel,
  getEntityId?: (data: Tenant) => { tenantId: string } | undefined
) {
  return createEvent<Tenant, ListenerConfig<T>, { tenantId: string }>({
    name,
    category,
    level,
    source: 'tenant',
    getEntityRef: getEntityId,
  });
}

export const TenantEvents = {
  // Tenant Management
  TenantCreated: createTenantEvent<TenantManagementEventData>(
    'tenant.created',
    'tenant' as LogCategory,
    'info' as LogLevel,
  ),
  
  TenantUpdated: createTenantEvent<TenantManagementEventData & { changes: Record<string, unknown> }>(
    'tenant.updated',
    'tenant' as LogCategory,
    'info' as LogLevel,
  ),
  
  TenantDeleted: createTenantEvent<TenantManagementEventData>(
    'tenant.deleted',
    'tenant' as LogCategory,
    'warning' as LogLevel,
  ),
  
  // Subscription Events
  SubscriptionCreated: createTenantEvent<SubscriptionEventData>(
    'subscription.created',
    'billing' as LogCategory,
    'info' as LogLevel,
  ),
  
  SubscriptionUpdated: createTenantEvent<SubscriptionEventData & { changes: Record<string, unknown> }>(
    'subscription.updated',
    'billing' as LogCategory,
    'info' as LogLevel,
  ),
  
  SubscriptionCancelled: createTenantEvent<SubscriptionEventData & { 
    reason?: string;
    cancelledAt: string;
  }>(
    'subscription.cancelled',
    'billing' as LogCategory,
    'warning' as LogLevel,
  ),
  
  SubscriptionRenewed: createTenantEvent<SubscriptionEventData>(
    'subscription.renewed',
    'billing' as LogCategory,
    'info' as LogLevel,
  ),
  
  // Payment Events
  PaymentSucceeded: createTenantEvent<{
    paymentId: string;
    amount: number;
    currency: string;
    subscriptionId?: string;
    tenantId: string;
    metadata?: Record<string, unknown>;
  }>(
    'payment.succeeded',
    'billing' as LogCategory,
    'info' as LogLevel
  ),
  
  PaymentFailed: createTenantEvent<{
    paymentId: string;
    amount: number;
    currency: string;
    error: string;
    subscriptionId?: string;
    tenantId: string;
    metadata?: Record<string, unknown>;
  }>(
    'payment.failed',
    'billing' as LogCategory,
    'error' as LogLevel
  ),
  
  // Invoice Events
  InvoiceGenerated: createTenantEvent<InvoiceEventData>(
    'invoice.generated',
    'billing' as LogCategory,
    'info' as LogLevel,
  ),
  
  InvoicePaid: createTenantEvent<InvoiceEventData & {
    paymentId: string;
    paidAt: string;
  }>(
    'invoice.paid',
    'billing' as LogCategory,
    'info' as LogLevel,
  ),
  
  InvoiceFailed: createTenantEvent<InvoiceEventData & {
    error: string;
    retryAttempt: number;
  }>(
    'invoice.failed',
    'billing' as LogCategory,
    'error' as LogLevel,
  )
};

/**
 * Helper function to create a tenant event listener
 * @param event The tenant event to listen for
 * @param config Configuration for the listener
 * @param workflowId The ID of the workflow to trigger
 * @returns A trigger definition that can be used to listen for the event
 */
export function createTenantListener<T extends BaseTenantEventData>(
  event: {
    createListener: (config: ListenerConfig<T>, workflowId: string) => {
      id: string;
      name: string;
      type: string;
      description?: string;
      pattern: Record<string, unknown>;
      action: {
        type: string;
        workflowId: string;
        nodeId?: string;
      };
    };
  },
  config: TenantListenerConfig<T>,
  workflowId: string
) {
  const { tenantId, plan, status, billingCycle, where, ...rest } = config;
  
  const listenerConfig: ListenerConfig<T> = {
    ...rest,
    entityType: EntityType.TENANT,
    where: {
      ...(tenantId && { tenantId }),
      ...(plan && { plan }),
      ...(status && { status }),
      ...(billingCycle && { billingCycle }),
      ...where,
    } as Partial<T>,
  };
  
  return event.createListener(listenerConfig, workflowId);
}

export default TenantEvents;
