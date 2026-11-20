import { createEvent } from './create-event';
import { LogCategory, LogLevel, User } from '../../schemas';
import { EntityType, BaseEventData, ListenerConfig } from './types';

/**
 * Base interface for all authentication-related events
 */
interface BaseAuthEventData extends BaseEventData {
  // The ID of the tenant this event belongs to
  tenantId: string;
  // The user who triggered the event (if applicable)
  userId?: string;
  // Additional metadata
  [key: string]: unknown;
}

/**
 * User registration events
 */
export interface UserRegistrationEventData extends BaseAuthEventData {
  // The email of the registered user
  email: string;
  // The registration method (e.g., 'email', 'sso', 'invitation')
  registrationMethod: string;
  // Additional registration details
  metadata?: Record<string, unknown>;
}

/**
 * User login events
 */
export interface UserLoginEventData extends BaseAuthEventData {
  // The login method (e.g., 'password', 'sso', 'magic-link')
  method: 'password' | 'sso' | 'magic-link' | 'token';
  // The IP address of the login attempt
  ipAddress?: string;
  // The user agent of the login attempt
  userAgent?: string;
  // Whether the login was successful
  success: boolean;
  // Additional login details
  metadata?: Record<string, unknown>;
}

/**
 * Password reset events
 */
export interface PasswordResetEventData extends BaseAuthEventData {
  // The email of the user requesting the password reset
  email: string;
  // The reset token (only included in some events for security reasons)
  resetToken?: string;
  // Whether the reset was successful
  success: boolean;
}

/**
 * MFA (Multi-Factor Authentication) events
 */
export interface MFAEventData extends BaseAuthEventData {
  // The MFA method (e.g., 'totp', 'sms', 'email', 'authenticator')
  method: string;
  // Whether the operation was successful
  success: boolean;
  // Additional MFA details
  metadata?: Record<string, unknown>;
}

/**
 * Session events
 */
export interface SessionEventData extends BaseAuthEventData {
  // The session ID
  sessionId: string;
  // The IP address of the session
  ipAddress?: string;
  // The user agent of the session
  userAgent?: string;
  // Additional session details
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for auth event listeners
 */
export interface AuthListenerConfig<T extends BaseAuthEventData> 
  extends Omit<ListenerConfig<T>, 'where' | 'entityType'> {
  // Filter by user ID
  userId?: string | string[] | RegExp;
  // Filter by email (for login/registration events)
  email?: string | string[] | RegExp;
  // Filter by success status (for login/password reset events)
  success?: boolean;
  // Filter by method (for login/MFA events)
  method?: string | string[];
  // Additional custom filters
  where?: Partial<T>;
}

/**
 * Creates an auth event with proper entity references
 */
function createAuthEvent<T extends BaseAuthEventData>(
  name: string, 
  category: LogCategory, 
  level: LogLevel,
  getEntityId?: (data: User) => { userId: string } | undefined
) {
  return createEvent<User, ListenerConfig<T>, { userId: string }>({
    name,
    category,
    level,
    source: 'auth',
    getEntityRef: getEntityId ? getEntityId : undefined,
  });
}

/**
 * Helper function to create an auth event listener
 * @param event The auth event to listen for
 * @param config Configuration for the listener
 * @param workflowId The ID of the workflow to trigger
 * @returns A trigger definition that can be used to listen for the event
 */
export function createAuthListener<T extends BaseAuthEventData>(
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
  config: AuthListenerConfig<T>,
  workflowId: string
) {
  const { userId, email, success, method, where, ...rest } = config;
  
  const listenerConfig: ListenerConfig<T> = {
    ...rest,
    entityType: EntityType.USER,
    where: {
      ...(userId && { userId }),
      ...(email && { email }),
      ...(success !== undefined && { success }),
      ...(method && { method }),
      ...where,
    } as Partial<T>,
  };
  
  return event.createListener(listenerConfig, workflowId);
}

export const AuthEvents = {
  // User Registration Events
  UserRegistered: createAuthEvent<UserRegistrationEventData>(
    'user.registered',
    'user' as LogCategory,
    'info' as LogLevel,
    (data) => ({ userId: data.userId })
  ),
  
  UserRegistrationVerified: createAuthEvent<UserRegistrationEventData>(
    'user.registration.verified',
    'user' as LogCategory,
    'info' as LogLevel,
    (data) => ({ userId: data.userId })
  ),
  
  // User Login Events
  UserLoggedIn: createAuthEvent<UserLoginEventData>(
    'user.logged_in',
    'user' as LogCategory,
    'info' as LogLevel,
    (data) => ({ userId: data.userId })
  ),
  
  LoginFailed: createAuthEvent<BaseAuthEventData & {
    email: string;
    reason: string;
    method?: string;
  }>(
    'auth.login_failed',
    'security' as LogCategory,
    'warning' as LogLevel
  ),
  
  // Password Reset Events
  PasswordResetRequested: createAuthEvent<PasswordResetEventData>(
    'auth.password_reset_requested',
    'security' as LogCategory,
    'info' as LogLevel
  ),
  
  PasswordReset: createAuthEvent<PasswordResetEventData>(
    'auth.password_reset',
    'security' as LogCategory,
    'info' as LogLevel,
    (data) => ({ userId: data.userId })
  ),
  
  // MFA Events
  MFAEnabled: createAuthEvent<MFAEventData>(
    'auth.mfa_enabled',
    'security' as LogCategory,
    'info' as LogLevel,
    (data) => ({ userId: data.userId })
  ),
  
  MFADisabled: createAuthEvent<MFAEventData>(
    'auth.mfa_disabled',
    'security' as LogCategory,
    'info' as LogLevel,
    (data) => ({ userId: data.userId })
  ),
  
  MFAChallengePassed: createAuthEvent<MFAEventData>(
    'auth.mfa_challenge_passed',
    'security' as LogCategory,
    'info' as LogLevel,
    (data) => ({ userId: data.userId })
  ),
  
  MFAChallengeFailed: createAuthEvent<MFAEventData>(
    'auth.mfa_challenge_failed',
    'security' as LogCategory,
    'warning' as LogLevel,
    (data) => ({ userId: data.userId })
  ),
  
  // Session Events
  SessionCreated: createAuthEvent<SessionEventData>(
    'auth.session.created',
    'security' as LogCategory,
    'info' as LogLevel,
    (data) => ({ userId: data.userId })
  ),
  
  SessionRevoked: createAuthEvent<SessionEventData>(
    'auth.session.revoked',
    'security' as LogCategory,
    'info' as LogLevel,
    (data) => ({ userId: data.userId })
  ),
  
  SessionExpired: createAuthEvent<SessionEventData>(
    'auth.session.expired',
    'security' as LogCategory,
    'info' as LogLevel,
    (data) => ({ userId: data.userId })
  ),
  
  // Account Events
  AccountLocked: createAuthEvent<BaseAuthEventData & { reason: string; lockedUntil?: string }>(
    'auth.account.locked',
    'security' as LogCategory,
    'warning' as LogLevel,
    (data) => ({ userId: data.userId })
  ),
  
  AccountUnlocked: createAuthEvent<BaseAuthEventData>(
    'auth.account.unlocked',
    'security' as LogCategory,
    'info' as LogLevel,
    (data) => ({ userId: data.userId })
  ),
  
  // Permission Events
  PermissionDenied: createAuthEvent<BaseAuthEventData & { 
    permission: string; 
    resource?: string;
    reason?: string;
  }>(
    'auth.permission.denied',
    'security' as LogCategory,
    'warning' as LogLevel,
    (data) => ({ userId: data.userId })
  ),
};
