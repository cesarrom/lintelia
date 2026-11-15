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