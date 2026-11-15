import { Permission } from './permissions';

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