'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Settings,
  Workflow,
  Shield,
  BarChart,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { PermissionGate } from '@/components/auth/PermissionGate';

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Workflows',
    href: '/workflows',
    icon: Workflow,
    permission: 'canManageWorkflows',
  },
  {
    name: 'Users',
    href: '/settings/users',
    icon: Users,
    permission: 'canManageUsers',
  },
  {
    name: 'Roles',
    href: '/settings/roles',
    icon: Shield,
    permission: 'canManageRoles',
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, user, tenant, logout } = useAuth();

  if (!isAuthenticated) return null;

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  return (
    <div className="flex h-full w-64 flex-col bg-gray-900">
      <div className="flex h-16 items-center justify-center border-b border-gray-800 px-4">
        <h1 className="text-xl font-bold text-white">
          {tenant ? tenant.charAt(0).toUpperCase() + tenant.slice(1) : 'Workflow Engine'}
        </h1>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <nav className="flex-1 space-y-1 px-2 py-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const MenuItem = () => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  isActive
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white',
                  'group flex items-center rounded-md px-2 py-2 text-sm font-medium'
                )}
              >
                <item.icon
                  className={cn(
                    isActive
                      ? 'text-white'
                      : 'text-gray-400 group-hover:text-white',
                    'mr-3 h-5 w-5 flex-shrink-0'
                  )}
                />
                {item.name}
              </Link>
            );

            return item.permission ? (
              <PermissionGate key={item.name} permissions={{ [item.permission]: true }}>
                <MenuItem />
              </PermissionGate>
            ) : (
              <MenuItem key={item.name} />
            );
          })}
        </nav>
        <div className="border-t border-gray-800 p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 rounded-full bg-gray-700 flex items-center justify-center">
                <span className="text-white text-sm">
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-white">
                {user?.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-4 flex w-full items-center rounded-md px-2 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            <LogOut className="mr-3 h-5 w-5 text-gray-400" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
} 