'use server';

import { revalidatePath } from 'next/cache';
import { inject } from '@/lib/injector/utils';
import { UsersService, RolesService } from '@/lib/services';
import { User } from '@/lib/services/users.service';

// List users
export const getUsers = inject(
  [UsersService],
  async (_, [usersService]) => {
    const users = await usersService.listUsers();
    revalidatePath('/users');
    return users;
  }
);

// Get a user by ID
export const getUser = inject(
  [UsersService],
  async (context, [usersService], id: string) => {
    return usersService.getUser(id);
  }
);

// Invite a new user
export const inviteUser = inject(
  [UsersService],
  async (context, [usersService], data: { email: string; name: string; roleIds: string[] }) => {
    const success = await usersService.inviteUser(data);
    revalidatePath('/users');
    return success;
  }
);

// Update user roles
export const updateUserRoles = inject(
  [UsersService],
  async (context, [usersService], userId: string, roleIds: string[]) => {
    const success = await usersService.updateUserRoles(userId, roleIds);
    revalidatePath('/users');
    return success;
  }
);

// Deactivate a user
export const deactivateUser = inject(
  [UsersService],
  async (context, [usersService], userId: string) => {
    const success = await usersService.deactivateUser(userId);
    revalidatePath('/users');
    return success;
  }
);

// Activate a user
export const activateUser = inject(
  [UsersService],
  async (context, [usersService], userId: string) => {
    const success = await usersService.activateUser(userId);
    revalidatePath('/users');
    return success;
  }
);

// Reset user password
export const resetUserPassword = inject(
  [UsersService],
  async (context, [usersService], userId: string) => {
    const success = await usersService.resetPassword(userId);
    revalidatePath('/users');
    return success;
  }
); 