// Basic permission actions
export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'manage';

// Resource types that can have permissions
export type ResourceType = 
  | 'forms'
  | 'workflows'
  | 'email_templates'
  | 'roles'
  | 'users'
  | 'invitations'
  | 'files'
  | 'applications';

// Structure for a single permission
export interface Permission {
  action: PermissionAction;
  resource: ResourceType;
  conditions?: {
    // Optional conditions that must be met for the permission to be valid
    ownedByUser?: boolean;     // Only resources owned by the user
    assignedToUser?: boolean;  // Only resources assigned to the user
    status?: string[];        // Only resources with specific status
  };
}

// Full permissions structure for a role
export interface RolePermissions {
  // List of granted permissions
  permissions: Permission[];
  
  // Optional metadata
  metadata?: {
    isAdmin?: boolean;        // Has full system access
    isSupervisor?: boolean;   // Can manage other users
    isReadOnly?: boolean;     // Can only read data
    customFlags?: string[];   // Any custom permission flags
  };
} 