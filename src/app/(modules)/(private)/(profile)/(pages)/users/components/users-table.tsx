'use client';

import { useState } from 'react';
import { User } from '@/lib/services/users.service';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Edit, 
  Key, 
  Lock, 
  Unlock, 
  MoreHorizontal 
} from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  activateUser, 
  deactivateUser, 
  resetUserPassword 
} from '../actions';
import { useRouter } from 'next/navigation';
import EditUserRolesDialog from './edit-user-roles-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';

interface UsersTableProps {
  users: User[];
}

export default function UsersTable({ users }: UsersTableProps) {
  const router = useRouter();
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const handleStatusChange = async (user: User) => {
    if (user.status === 'active') {
      await deactivateUser(user.id);
    } else {
      await activateUser(user.id);
    }
    router.refresh();
  };

  const handleResetPassword = async (userId: string) => {
    if (confirm('Are you sure you want to reset this user\'s password?')) {
      await resetUserPassword(userId);
      router.refresh();
    }
  };

  const handleEditRoles = (user: User) => {
    setEditingUser(user);
    setIsEditDialogOpen(true);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase();
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Roles</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Updated</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={user.picture} />
                    <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{user.name}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {user.roles.slice(0, 2).map((role) => (
                    <Badge key={role} variant="secondary">
                      {role}
                    </Badge>
                  ))}
                  {user.roles.length > 2 && (
                    <Badge variant="outline">
                      +{user.roles.length - 2} more
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant={user.status === 'active' ? 'default' : 'secondary'}
                >
                  {user.status}
                </Badge>
              </TableCell>
              <TableCell>
                {formatDistanceToNow(user.updatedAt, { addSuffix: true })}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Open menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEditRoles(user)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit Roles
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleResetPassword(user.id)}>
                      <Key className="mr-2 h-4 w-4" />
                      Reset Password
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange(user)}>
                      {user.status === 'active' ? (
                        <>
                          <Lock className="mr-2 h-4 w-4" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <Unlock className="mr-2 h-4 w-4" />
                          Activate
                        </>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
          {users.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-6">
                No users found. Invite your first user to get started.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <EditUserRolesDialog
        user={editingUser}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />
    </>
  );
} 