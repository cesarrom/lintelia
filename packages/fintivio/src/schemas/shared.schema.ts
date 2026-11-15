import { z } from 'zod';

export const logLevelSchema = z.enum(['info', 'warning', 'error', 'debug']);
export type LogLevel = z.infer<typeof logLevelSchema>;

export const logCategorySchema = z.enum(['system', 'workflow', 'user', 'form', 'security', 'integration', 'review', 'database']);
export type LogCategory = z.infer<typeof logCategorySchema>;

export const reviewStatusValuesSchema = z.enum(['pending', 'in_progress', 'approved', 'rejected', 'additional_data_requested']);
export type ReviewStatus = z.infer<typeof reviewStatusValuesSchema>;

export const reviewItemSchema = z.object({
  answer_id: z.string(),
  label: z.string().optional(),
  status: reviewStatusValuesSchema,
  comments: z.string().optional(),
})

export type ReviewItem = z.infer<typeof reviewItemSchema>;

export const evidenceItemSchema = z.object({
  type: z.string(),
  url: z.string().url(),
  name: z.string(),
  description: z.string().optional(),
});

export type EvidenceItem = z.infer<typeof evidenceItemSchema>;

export const workflowExecutionStatusSchema = z.enum(['pending', 'running', 'completed', 'failed']);

export type WorkflowExecutionStatus = z.infer<typeof workflowExecutionStatusSchema>;

export const workflowTriggerStatusSchema = z.enum(['active', 'inactive']);

export type WorkflowTriggerStatus = z.infer<typeof workflowTriggerStatusSchema>;

export const workflowStatusSchema = z.enum(['draft', 'active', 'archived']);

export type WorkflowStatus = z.infer<typeof workflowStatusSchema>;

export const eventContextSchema = z.object({
  log: z.object({
    id: z.string(),
    category: logCategorySchema,
    message: z.string(),
    level: logLevelSchema,
    source: z.string(),
    metadata: z.array(z.object({
      path: z.array(z.string()),
      pattern: z.unknown(),
    })),
  }),
  inputs: z.record(z.unknown()),
});

export type EventContext = z.infer<typeof eventContextSchema>;

export type EventHandler = (context: EventContext) => Promise<void>;

export const triggerActionSchema = z.object({
  type: z.enum(['RESUME', 'INVOKE']),
  workflowId: z.string(),
  nodeId: z.string().optional(),
  inputs: z.record(z.unknown()).optional(),
});

export type TriggerAction = z.infer<typeof triggerActionSchema>;

export const triggerPatternSchema = z.object({
  category: logCategorySchema.optional(),
  message: z.string().optional(),
  level: logLevelSchema.optional(),
  source: z.string().optional(),
  metadata: z.array(z.object({
    path: z.array(z.string()),
    pattern: z.unknown(),
  })).optional(),
});

export type TriggerPattern = z.infer<typeof triggerPatternSchema>;

export const triggerDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  description: z.string().optional(),
  pattern: triggerPatternSchema,
  action: triggerActionSchema,
});

export type TriggerDefinition = z.infer<typeof triggerDefinitionSchema>;

// Define all available permissions in the system
// These permissions are used to control access to different parts of the application

export type Permission = {
  id: string;
  name: string;
  description: string;
  category: string;
};

// Categories help organize permissions in the UI
export const PERMISSION_CATEGORIES = [
  'Workflows',
  'Users',
  'Roles',
  'Logs',
  'Forms',
  'Reviews',
  'System',
] as const;

export type PermissionCategory = typeof PERMISSION_CATEGORIES[number];

// All available permissions in the system
export const PERMISSIONS: Permission[] = [
  // Workflow permissions
  {
    id: 'workflows:view',
    name: 'View Workflows',
    description: 'Can view workflows',
    category: 'Workflows',
  },
  {
    id: 'workflows:manage',
    name: 'Manage Workflows',
    description: 'Can create, edit, and delete workflows',
    category: 'Workflows',
  },
  {
    id: 'workflows:execute',
    name: 'Execute Workflows',
    description: 'Can execute workflows',
    category: 'Workflows',
  },

  // User permissions
  {
    id: 'users:view',
    name: 'View Users',
    description: 'Can view users',
    category: 'Users',
  },
  {
    id: 'users:manage',
    name: 'Manage Users',
    description: 'Can create, edit, and delete users',
    category: 'Users',
  },

  // Role permissions
  {
    id: 'roles:view',
    name: 'View Roles',
    description: 'Can view roles',
    category: 'Roles',
  },
  {
    id: 'roles:manage',
    name: 'Manage Roles',
    description: 'Can create, edit, and delete roles',
    category: 'Roles',
  },

  // Log permissions
  {
    id: 'logs:view',
    name: 'View Logs',
    description: 'Can view logs',
    category: 'Logs',
  },
  {
    id: 'logs:manage',
    name: 'Manage Logs',
    description: 'Can manage logs',
    category: 'Logs',
  },

  // Form permissions
  {
    id: 'forms:view',
    name: 'View Forms',
    description: 'Can view forms',
    category: 'Forms',
  },
  {
    id: 'forms:manage',
    name: 'Manage Forms',
    description: 'Can create, edit, and delete forms',
    category: 'Forms',
  },

  // Review permissions
  {
    id: 'reviews:view',
    name: 'View Reviews',
    description: 'Can view reviews',
    category: 'Reviews',
  },
  {
    id: 'reviews:manage',
    name: 'Manage Reviews',
    description: 'Can create, edit, and delete reviews',
    category: 'Reviews',
  },

  // System permissions
  {
    id: 'admin',
    name: 'Administrator',
    description: 'Full access to all features',
    category: 'System',
  },
  {
    id: 'super_admin',
    name: 'Super Administrator',
    description: 'Unrestricted access to all features and settings',
    category: 'System',
  },
];

// Helper function to get permissions by category
export const getPermissionsByCategory = (category: PermissionCategory): Permission[] => {
  return PERMISSIONS.filter(permission => permission.category === category);
};

// Helper function to check if a permission exists
export const permissionExists = (permissionId: string): boolean => {
  return PERMISSIONS.some(permission => permission.id === permissionId);
};

// Default permissions for new roles
export const DEFAULT_PERMISSIONS: string[] = ['workflows:view', 'forms:view', 'reviews:view']; 

export type Role = {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem?: boolean; // System roles cannot be deleted
  createdAt: Date;
  updatedAt: Date;
};

// System roles that cannot be deleted
export const SYSTEM_ROLES: Omit<Role, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'super_admin',
    name: 'Super Administrator',
    description: 'Has unrestricted access to all features and settings',
    permissions: ['super_admin'],
    isSystem: true,
  },
  {
    id: 'admin',
    name: 'Administrator',
    description: 'Has access to all features',
    permissions: ['admin'],
    isSystem: true,
  },
  {
    id: 'user',
    name: 'User',
    description: 'Regular user with limited permissions',
    permissions: ['workflows:view', 'forms:view', 'reviews:view'],
    isSystem: true,
  },
];

// Helper function to check if a role is a system role
export const isSystemRole = (roleId: string): boolean => {
  return SYSTEM_ROLES.some(role => role.id === roleId);
};

// Helper function to get all permissions for a role
export const getRolePermissions = (role: Role): string[] => {
  return role.permissions;
};

// Helper function to check if a role has a specific permission
export const roleHasPermission = (role: Role, permissionId: string): boolean => {
  // Super admin has all permissions
  if (role.permissions.includes('super_admin')) {
    return true;
  }
  
  // Admin has all permissions except super_admin specific ones
  if (role.permissions.includes('admin')) {
    return permissionId !== 'super_admin';
  }
  
  return role.permissions.includes(permissionId);
}; 

import { type UserResponse } from "@descope/core-js-sdk";

export type User = UserResponse;