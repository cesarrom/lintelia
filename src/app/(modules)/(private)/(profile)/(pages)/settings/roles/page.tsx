'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { ProtectedRoute } from '@/app/(modules)/(private)/(auth)/(components)/auth/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Header } from '@/components/layout/Header';

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: {
    canManageUsers: boolean;
    canManageRoles: boolean;
    canManageWorkflows: boolean;
    canExecuteWorkflows: boolean;
  };
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [error, setError] = useState('');
  const { tenant } = useAuth();

  const [newRole, setNewRole] = useState<Omit<Role, 'id'>>({
    name: '',
    description: '',
    permissions: {
      canManageUsers: false,
      canManageRoles: false,
      canManageWorkflows: false,
      canExecuteWorkflows: false,
    },
  });

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch('/api/roles/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newRole,
          tenant,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create role');
      }

      setNewRole({
        name: '',
        description: '',
        permissions: {
          canManageUsers: false,
          canManageRoles: false,
          canManageWorkflows: false,
          canExecuteWorkflows: false,
        },
      });
      setIsCreateOpen(false);
      // Refresh roles list
      fetchRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await fetch('/api/roles/list');
      if (!response.ok) throw new Error('Failed to fetch roles');
      const data = await response.json();
      setRoles(data.roles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch roles');
    }
  };

  const togglePermission = (permission: keyof Role['permissions']) => {
    setNewRole(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permission]: !prev.permissions[permission],
      },
    }));
  };

  return (
    <ProtectedRoute requiredPermissions={{ canManageRoles: true }}>
      <div className="flex flex-col h-full">
        <Header
          title="Role Management"
          subtitle="Define roles and their permissions"
          actions={
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>Create Role</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Role</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateRole} className="space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium mb-1">
                      Role Name
                    </label>
                    <Input
                      id="name"
                      value={newRole.name}
                      onChange={(e) => setNewRole(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium mb-1">
                      Description
                    </label>
                    <Input
                      id="description"
                      value={newRole.description}
                      onChange={(e) => setNewRole(prev => ({ ...prev, description: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium mb-1">
                      Permissions
                    </label>
                    {Object.entries(newRole.permissions).map(([key, value]) => (
                      <div key={key} className="flex items-center space-x-2">
                        <Checkbox
                          id={key}
                          checked={value}
                          onCheckedChange={() => togglePermission(key as keyof Role['permissions'])}
                        />
                        <label htmlFor={key} className="text-sm">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </label>
                      </div>
                    ))}
                  </div>
                  {error && (
                    <p className="text-red-500 text-sm">{error}</p>
                  )}
                  <Button type="submit" className="w-full">
                    Create Role
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          }
        />
        <div className="p-6">
          <div className="bg-white rounded-lg shadow">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>{role.name}</TableCell>
                    <TableCell>{role.description}</TableCell>
                    <TableCell>
                      {Object.entries(role.permissions)
                        .filter(([, value]) => value)
                        .map(([key]) => key.replace(/([A-Z])/g, ' $1').trim())
                        .join(', ')}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
} 