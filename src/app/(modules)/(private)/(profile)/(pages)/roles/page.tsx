import { Metadata } from 'next';
import { getRoles } from './actions';
import RolesTable from './components/roles-table';
import CreateRoleButton from './components/create-role-button';

export const metadata: Metadata = {
  title: 'Roles Management',
  description: 'Manage roles and permissions for your organization',
};

export default async function RolesPage() {
  const roles = await getRoles();

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Roles Management</h1>
          <p className="text-muted-foreground">
            Create and manage roles with specific permissions
          </p>
        </div>
        <CreateRoleButton />
      </div>

      <RolesTable roles={roles} />
    </div>
  );
} 