import { Metadata } from 'next';
import { getUsers } from './actions';
import UsersTable from './components/users-table';
import InviteUserButton from './components/invite-user-button';

export const metadata: Metadata = {
  title: 'Users Management',
  description: 'Manage users, roles, and permissions',
};

export default async function UsersPage() {
  const users = await getUsers();

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage users, their roles, and access permissions
          </p>
        </div>
        <InviteUserButton />
      </div>
      
      <UsersTable users={users} />
    </div>
  );
} 