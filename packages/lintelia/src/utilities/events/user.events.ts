import { createEvent } from './create-event';
import { LogCategory, LogLevel, type User } from '../../schemas';
import { EntityType, type BaseEventData, type ListenerConfig } from './types';

/**
 * Base interface for all user-related events
 */
interface BaseUserEventData extends BaseEventData {
  // The ID of the tenant this user belongs to
  tenantId: string;
  // The user who triggered the event (if applicable)
  userId?: string;
  // Additional metadata
  [key: string]: unknown;
}

/**
 * User profile events
 */
export interface UserProfileEventData extends BaseUserEventData {
  // The user ID
  userId: string;
  // The user's email
  email: string;
  // The user's first name
  firstName?: string;
  // The user's last name
  lastName?: string;
  // The user's status (active, inactive, suspended, etc.)
  status?: User['status'];
  // The user's roles
  roles?: string[];
}

/**
 * Role and permission events
 */
export interface RoleEventData extends BaseUserEventData {
  // The role ID
  roleId: string;
  // The role name
  name: string;
  // The role description
  description?: string;
  // The permissions assigned to this role
  permissions?: string[];
  // The role status
  status?: 'active' | 'inactive' | 'deleted';
}

/**
 * User session events
 */
export interface UserSessionEventData extends BaseUserEventData {
  // The session ID
  sessionId: string;
  // The user ID
  userId: string;
  // The IP address of the client
  ipAddress?: string;
  // The user agent string of the client
  userAgent?: string;
  // The time the session was created (ISO 8601)
  createdAt: string;
  // The time the session expires (ISO 8601)
  expiresAt?: string;
}

/**
 * Configuration for user event listeners
 */
export interface UserListenerConfig<T extends BaseUserEventData> 
  extends Omit<ListenerConfig<T>, 'where' | 'entityType'> {
  // Filter by user ID
  userId?: string | string[] | RegExp;
  // Filter by user email
  email?: string | string[] | RegExp;
  // Filter by role ID or name
  role?: string | string[] | RegExp;
  // Filter by permission
  permission?: string | string[] | RegExp;
  // Filter by status
  status?: User['status'] | User['status'][] | RegExp;
  // Additional custom filters
  where?: Partial<T>;
}

/**
 * Creates a user event with proper entity references
 */
function createUserEvent<T extends BaseUserEventData>(
  name: string, 
  category: LogCategory, 
  level: LogLevel,
  getEntityId?: (data: User) => { userId: string } | undefined
) {
  return createEvent<User, ListenerConfig<T>, { userId: string }>({
    name,
    category,
    level,
    source: 'user',
    getEntityRef: getEntityId,
  });
}

// Define the UserEvents object with proper typing
export const UserEvents = {
  // User Profile Events
  ProfileUpdated: createUserEvent<UserProfileEventData & { changes: Record<string, unknown> }>(
    'user.profile.updated',
    'user' as LogCategory,
    'info' as LogLevel,
  ),
  
  // Role Events
  RoleCreated: createUserEvent<RoleEventData>(
    'user.role.created',
    'user' as LogCategory,
    'info' as LogLevel,
  ),
  
  RoleUpdated: createUserEvent<RoleEventData & { changes: Record<string, unknown> }>(
    'user.role.updated',
    'user' as LogCategory,
    'info' as LogLevel,
  ),
  
  RoleDeleted: createUserEvent<RoleEventData>(
    'user.role.deleted',
    'user' as LogCategory,
    'warning' as LogLevel,
  ),
  
  // Permission Events
  PermissionGranted: createUserEvent<RoleEventData & { permission: string }>(
    'user.permission.granted',
    'user' as LogCategory,
    'info' as LogLevel,
  ),
  
  PermissionRevoked: createUserEvent<RoleEventData & { permission: string }>(
    'user.permission.revoked',
    'user' as LogCategory,
    'info' as LogLevel,
  ),
  
  // Session Events
  SessionCreated: createUserEvent<UserSessionEventData>(
    'user.session.created',
    'security' as LogCategory,
    'info' as LogLevel,
  ),
  
  SessionRevoked: createUserEvent<UserSessionEventData & { reason?: string }>(
    'user.session.revoked',
    'security' as LogCategory,
    'info' as LogLevel,
  ),
  
  // User Status Events
  UserStatusChanged: createUserEvent<UserProfileEventData & { 
    previousStatus: string;
    reason?: string;
  }>(
    'user.status.changed',
    'user' as LogCategory,
    'info' as LogLevel,
  ),
};

/**
 * Helper function to create a user event listener
 * @param event The user event to listen for
 * @param config Configuration for the listener
 * @param workflowId The ID of the workflow to trigger
 * @returns A trigger definition that can be used to listen for the event
 */
export function createUserListener<T extends BaseUserEventData>(
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
  config: UserListenerConfig<T>,
  workflowId: string
) {
  const { userId, email, role, permission, status, where, ...rest } = config;
  
  const listenerConfig: ListenerConfig<T> = {
    ...rest,
    entityType: EntityType.USER,
    where: {
      ...(userId && { userId }),
      ...(email && { email }),
      ...(role && { role }),
      ...(permission && { permission }),
      ...(status && { status }),
      ...where,
    } as Partial<T>,
  };
  
  return event.createListener(listenerConfig, workflowId);
}

export default UserEvents;
