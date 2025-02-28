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
    href: '/users',
    permission: 'users:manage',
  },
  {
    name: 'Roles',
    href: '/roles',
    permission: 'roles:manage',
  },
  {
    name: 'Logs',
    href: '/logs',
    permission: 'logs:manage',
  },
  {
    name: 'Settings',
    href: '/settings',
  },
  {
    name: 'Forms',
    href: '/forms',
    permission: 'forms:manage',
  },
  {
    name: 'Reviews',
    href: '/reviews',
    permission: 'reviews:manage',
  }
];
