'use server';

import { revalidatePath } from 'next/cache';
import { Role } from '@/lib/auth/roles';
import { inject } from '@/lib/injector/utils';
import { RolesService } from '@/lib/services/roles.service';

// Mock database for roles (in a real app, this would be a database)
let roles: Role[] = [
  {
    id: 'super_admin',
    name: 'Super Administrator',
    description: 'Has unrestricted access to all features and settings',
    permissions: ['super_admin'],
    isSystem: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'admin',
    name: 'Administrator',
    description: 'Has access to all features',
    permissions: ['admin'],
    isSystem: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'user',
    name: 'User',
    description: 'Regular user with limited permissions',
    permissions: ['workflows:view', 'forms:view', 'reviews:view'],
    isSystem: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'workflow_manager',
    name: 'Workflow Manager',
    description: 'Can manage workflows',
    permissions: ['workflows:view', 'workflows:manage', 'workflows:execute'],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Get all roles
export const getRoles = inject(
  [RolesService],
  async (_, [userService]) => {
    const roles = await userService.listRoles();
    revalidatePath('/roles');
    return roles;
  }
);

// Get a role by ID
export const getRole = inject(
  [RolesService],
  async (context, [userService], id: string) => {
    return userService.getRole(id);
  }
);

// Create a new role
export const createRole = inject(
  [RolesService],
  async (context, [userService], data: { name: string; description: string; permissions: string[] }) => {
    const role = await userService.createRole(data);
    revalidatePath('/roles');
    return role;
  }
);

// Update a role
export const updateRole = inject(
  [RolesService],
  async (context, [userService], id: string, data: { name?: string; description?: string; permissions?: string[] }) => {
    const role = await userService.updateRole(id, data);
    revalidatePath('/roles');
    return role;
  }
);

// Delete a role
export const deleteRole = inject(
  [RolesService],
  async (context, [userService], id: string) => {
    const success = await userService.deleteRole(id);
    revalidatePath('/roles');
    return success;
  }
); 