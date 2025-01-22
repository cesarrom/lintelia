import { AppModule } from './types';

export const APP_MODULES: AppModule[] = [
  {
    id: 'workflows',
    name: 'Workflows',
    description: 'Workflow management and execution',
    actions: [
      {
        id: 'view',
        name: 'View Workflows',
        description: 'View workflow list and details',
      },
      {
        id: 'create',
        name: 'Create Workflows',
        description: 'Create new workflows',
      },
      {
        id: 'edit',
        name: 'Edit Workflows',
        description: 'Modify existing workflows',
      },
      {
        id: 'delete',
        name: 'Delete Workflows',
        description: 'Delete existing workflows',
      },
      {
        id: 'execute',
        name: 'Execute Workflows',
        description: 'Run workflows',
      },
    ],
  },
  {
    id: 'users',
    name: 'Users',
    description: 'User management',
    actions: [
      {
        id: 'view',
        name: 'View Users',
        description: 'View user list and details',
      },
      {
        id: 'invite',
        name: 'Invite Users',
        description: 'Invite new users to the system',
      },
      {
        id: 'edit',
        name: 'Edit Users',
        description: 'Modify user details and roles',
      },
      {
        id: 'delete',
        name: 'Delete Users',
        description: 'Remove users from the system',
      },
    ],
  },
  {
    id: 'roles',
    name: 'Roles',
    description: 'Role and permission management',
    actions: [
      {
        id: 'view',
        name: 'View Roles',
        description: 'View role list and details',
      },
      {
        id: 'create',
        name: 'Create Roles',
        description: 'Create new roles',
      },
      {
        id: 'edit',
        name: 'Edit Roles',
        description: 'Modify existing roles',
      },
      {
        id: 'delete',
        name: 'Delete Roles',
        description: 'Delete existing roles',
      },
    ],
  },
  {
    id: 'analytics',
    name: 'Analytics',
    description: 'System analytics and reporting',
    actions: [
      {
        id: 'view',
        name: 'View Analytics',
        description: 'View analytics dashboards and reports',
      },
      {
        id: 'export',
        name: 'Export Reports',
        description: 'Export analytics data',
      },
    ],
  },
];

// Helper function to get module by ID
export const getModule = (moduleId: string): AppModule | undefined => {
  return APP_MODULES.find(module => module.id === moduleId);
};

// Helper function to check if an action exists in a module
export const hasAction = (moduleId: string, actionId: string): boolean => {
  return getModule(moduleId)?.actions.some(action => action.id === actionId) ?? false;
}; 