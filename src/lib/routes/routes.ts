
export const routes = [
  {
    name: 'Dashboard',
    href: '/dashboard',
  },
  {
    name: 'Workflows',
    href: '/workflows',
    permission: 'workflows:manage',
  },
  {
    name: 'Users',
    href: '/settings/users',
    permission: 'users:manage',
  },
  {
    name: 'Roles',
    href: '/settings/roles',
    permission: 'roles:manage',
  },
  {
    name: 'Analytics',
    href: '/analytics',
  },
  {
    name: 'Settings',
    href: '/settings',
  },
];