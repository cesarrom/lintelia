'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { InviteUserDialog } from '@/components/settings/InviteUserDialog';
import { UserList } from '@/components/settings/UserList';
import { Header } from '@/components/layout/Header';

interface User {
  id: string;
  email: string;
  name: string;
  roles: string[];
  lastLogin?: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const { tenant } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users/list');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    }
  };

  const handleInviteUser = async (email: string) => {
    const response = await fetch('/api/users/invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        tenant,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Failed to invite user');
    }

    // Refresh user list
    fetchUsers();
  };

  const handleEditRoles = (userId: string) => {
    // TODO: Implement role editing dialog
    console.log('Edit roles for user:', userId);
  };

  if (error) {
    return (
      <div className="p-4 text-red-500">
        Error: {error}
      </div>
    );
  }

  return (
    <PermissionGuard requires={{ module: 'users', action: 'view' }}>
      <div className="flex flex-col h-full">
        <Header
          title="User Management"
          subtitle="Manage users and their permissions"
          actions={
            <PermissionGuard requires={{ module: 'users', action: 'invite' }}>
              <InviteUserDialog onInvite={handleInviteUser} />
            </PermissionGuard>
          }
        />
        <div className="p-6">
          <UserList 
            users={users} 
            onEditRoles={handleEditRoles}
          />
        </div>
      </div>
    </PermissionGuard>
  );
} 