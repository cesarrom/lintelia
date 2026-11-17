import type { LucideIcon } from 'lucide-react';
import {
  AppWindow, Building2, Map as MapIcon, Cable, ClipboardCheck, Plug, FileLock2, LifeBuoy, FileIcon, FolderKanban, FormInput, KeyIcon, LayoutDashboard, Logs, MailIcon, ScrollText,
  Settings, Shield, UserRound, Users, WebhookIcon, Workflow,
} from 'lucide-react';

export interface AppRoute {
  name: string;
  href: string;
  icon: LucideIcon;
  /** Shown when the user holds at least one of these permissions (none = everyone of the audience). */
  permissions?: string[];
  section: string;
}

/** Navigation of institution members; entries appear according to their permissions. */
export const memberRoutes: AppRoute[] = [
  { name: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard, section: 'Work' },
  { name: 'Tasks', href: '/app/tasks', icon: ClipboardCheck, permissions: ['tasks:work', 'tasks:assign'], section: 'Work' },
  { name: 'Cases', href: '/app/cases', icon: FolderKanban, permissions: ['cases:read'], section: 'Work' },
  { name: 'Clients', href: '/app/clients', icon: UserRound, permissions: ['clients:read'], section: 'Work' },
  { name: 'Map', href: '/app/map', icon: MapIcon, permissions: ['experience:read', 'workflows:read'], section: 'Build' },
  { name: 'Forms', href: '/app/forms', icon: FormInput, permissions: ['forms:read'], section: 'Build' },
  { name: 'Workflows', href: '/app/workflows', icon: Workflow, permissions: ['workflows:read'], section: 'Build' },
  { name: 'Client app', href: '/app/experience', icon: AppWindow, permissions: ['experience:read'], section: 'Build' },
  { name: 'Email Templates', href: '/app/emails', icon: MailIcon, permissions: ['templates:manage'], section: 'Build' },
  { name: 'Documents', href: '/app/documents', icon: FileIcon, permissions: ['templates:manage'], section: 'Build' },
  { name: 'Integrations', href: '/app/integrations', icon: Plug, permissions: ['integrations:read'], section: 'Build' },
  { name: 'Webhooks', href: '/app/webhooks', icon: WebhookIcon, permissions: ['webhooks:manage'], section: 'Build' },
  { name: 'API clients', href: '/app/keys', icon: KeyIcon, permissions: ['api_clients:manage'], section: 'Build' },
  { name: 'Team', href: '/app/users', icon: Users, permissions: ['members:read'], section: 'Administration' },
  { name: 'Roles', href: '/app/roles', icon: Shield, permissions: ['roles:read'], section: 'Administration' },
  { name: 'Audit log', href: '/app/audit', icon: ScrollText, permissions: ['audit:read'], section: 'Administration' },
  { name: 'Data requests', href: '/app/data-requests', icon: FileLock2, permissions: ['data_requests:manage'], section: 'Administration' },
  { name: 'Support access', href: '/app/support-access', icon: LifeBuoy, permissions: ['support_access:approve'], section: 'Administration' },
  { name: 'Logs', href: '/app/logs', icon: Logs, permissions: ['audit:read'], section: 'Administration' },
  { name: 'Settings', href: '/app/settings', icon: Settings, permissions: ['workspace:read'], section: 'Administration' },
];

/** Navigation of platform staff (the operator of Fintivio). */
export const staffRoutes: AppRoute[] = [
  { name: 'Institutions', href: '/app/platform/institutions', icon: Building2, permissions: ['platform.tenants:read'], section: 'Platform' },
  { name: 'Support access', href: '/app/platform/support-access', icon: LifeBuoy, permissions: ['platform.support_access:request'], section: 'Platform' },
  { name: 'Connectors', href: '/app/platform/connectors', icon: Cable, permissions: ['platform.connectors:manage'], section: 'Platform' },
  { name: 'Staff', href: '/app/platform/staff', icon: Users, permissions: ['platform.staff:manage'], section: 'Platform' },
  { name: 'Audit log', href: '/app/platform/audit', icon: ScrollText, permissions: ['platform.audit:read'], section: 'Platform' },
];
