import { useEffect, useState } from 'react';
import { NavLink } from 'react-router';
import { ChevronsLeft, ChevronsRight, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSession } from '@/lib/auth/session';
import { memberRoutes, staffRoutes, type AppRoute } from '@/lib/routes/routes';
import { LogoMark } from '@/components/brand/Logo';
import { Avatar, Monogram } from '@/components/brand/Monogram';
import { humanize } from '@/components/app/page';

const COLLAPSED_KEY = 'fintivio.sidebar.collapsed';

/** Main navigation: institution members see what their permissions allow; platform staff see the platform console. */
export function Sidebar() {
  const { isAuthenticated, user, tenant, kind, hasPermission, logout } = useAuth();
  const { session } = useSession();
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === '1');
  useEffect(() => localStorage.setItem(COLLAPSED_KEY, isCollapsed ? '1' : '0'), [isCollapsed]);

  if (!isAuthenticated) return null;

  const routes = (kind === 'staff' ? staffRoutes : memberRoutes)
    .filter((route) => !route.permissions || hasPermission(route.permissions));
  const sections = routes.reduce<Record<string, AppRoute[]>>((acc, route) => {
    (acc[route.section] ??= []).push(route);
    return acc;
  }, {});
  const staff = kind === 'staff';
  const title = staff ? 'Fintivio platform' : tenant?.name ?? 'Fintivio';
  const brandColor = session?.tenant?.pallette?.primary;
  const roleLabel = staff ? (user?.platformRoles ?? []).join(', ') : (user?.userTenants?.[0]?.roleNames ?? []).join(', ');
  const displayName = (user as { name?: string } | null)?.name;

  return (
    <aside
      className={cn(
        'relative flex h-full shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out',
        isCollapsed ? 'w-[68px]' : 'w-[248px]',
      )}
    >
      {/* workspace */}
      <div className={cn('flex h-14 items-center gap-2.5 px-3.5 pt-2', isCollapsed && 'justify-center px-0')}>
        {staff ? <LogoMark className="h-8 w-8 shrink-0" /> : <Monogram name={title} color={brandColor} size="md" className="h-8 w-8" />}
        {!isCollapsed && (
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[14px] font-semibold text-foreground" data-testid="workspace-name">{title}</p>
            <p className="truncate text-[11.5px] text-muted-foreground">{staff ? 'Operator console' : 'Back office'}</p>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <nav aria-label="Main" className="flex-1 space-y-5 overflow-y-auto px-2.5 pb-4 pt-4">
          {Object.entries(sections).map(([section, items]) => (
            <div key={section} className="space-y-0.5">
              {!isCollapsed
                ? <p className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80">{section}</p>
                : <div className="mx-auto mb-2 h-px w-6 bg-border" />}
              {items.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  title={isCollapsed ? item.name : undefined}
                  className={({ isActive }) => cn(
                    'group relative flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium transition-colors',
                    isActive
                      ? 'bg-background text-foreground shadow-raised ring-1 ring-border/70 dark:bg-accent'
                      : 'text-sidebar-foreground hover:bg-foreground/[0.045] hover:text-foreground',
                    isCollapsed && 'justify-center px-0',
                  )}
                >
                  {({ isActive }) => (
                    <>
                      <item.icon className={cn('h-[17px] w-[17px] shrink-0', isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
                      {!isCollapsed && item.name}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* account */}
        <div className="border-t border-border/70 p-2.5">
          <div className={cn('flex items-center gap-1 rounded-xl p-1', isCollapsed ? 'flex-col' : 'hover:bg-foreground/[0.035]')}>
            <NavLink to="/app/me" className={cn('flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1', isCollapsed && 'justify-center')} title="My profile">
              <Avatar name={displayName} email={user?.email} size="sm" className="ring-sidebar" />
              {!isCollapsed && (
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-[13px] font-medium text-foreground" data-testid="current-user">{user?.email}</p>
                  <p className="truncate text-[11.5px] text-muted-foreground">{humanize(roleLabel.split(',')[0] ?? '')}{roleLabel.includes(',') ? ` +${roleLabel.split(',').length - 1}` : ''}</p>
                </div>
              )}
            </NavLink>
            <button
              type="button"
              onClick={() => void logout()}
              title="Sign out"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Sign out</span>
            </button>
          </div>
          <button
            type="button"
            aria-label={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn('mt-1 flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-[12.5px] text-muted-foreground transition-colors hover:bg-foreground/[0.045] hover:text-foreground', isCollapsed && 'justify-center px-0')}
          >
            {isCollapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" />Collapse</>}
          </button>
        </div>
      </div>
    </aside>
  );
}
