export const routes = [
  {
    name: 'Dashboard',
    href: '/app/dashboard',
  },
  {
    name: 'API Keys',
    href: '/app/keys',
    permission: 'keys:manage',
  },
  {
    name: 'Email Templates',
    href: '/app/emails',
    permission: 'emails:manage',
  },
  {
    name: 'Documents',
    href: '/app/documents',
    permission: 'documents:manage',
  },
  {
    name: 'Webhooks',
    href: '/app/webhooks',
    permission: 'webhooks:manage',
  },
  {
    name: 'Database',
    href: '/app/database',
    permission: 'database:manage',
  },
  {
    name: 'Workflows',
    href: '/app/workflows',
    permission: 'workflows:manage',
  },
  {
    name: 'Users',
    href: '/app/users',
    permission: 'users:manage',
  },
  {
    name: 'Roles',
    href: '/app/roles',
    permission: 'roles:manage',
  },
  {
    name: 'Logs',
    href: '/app/logs',
    permission: 'logs:manage',
  },
  {
    name: 'Settings',
    href: '/app/settings',
  },
  {
    name: 'Forms',
    href: '/app/forms',
    permission: 'forms:manage',
  },
  {
    name: 'Reviews',
    href: '/app/reviews',
    permission: 'reviews:manage',
  }
];
