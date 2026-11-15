import { cn } from '@/lib/utils';
import { LogOut, ChevronLeft, ChevronRight, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useState } from 'react';
import { NavLink } from 'react-router';
import { Button } from '@/components/ui/button';
import { memberRoutes, staffRoutes, type AppRoute } from '@/lib/routes/routes';
import { useTheme } from '@/lib/providers/ThemeProvider';

/** Main navigation: institution members see what their permissions allow; platform staff see the platform console. */
export function Sidebar() {
  const { isAuthenticated, user, tenant, kind, hasPermission, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { theme, setTheme } = useTheme();

  if (!isAuthenticated) return null;

  const routes = (kind === 'staff' ? staffRoutes : memberRoutes)
    .filter((route) => !route.permissions || hasPermission(route.permissions));
  const sections = routes.reduce<Record<string, AppRoute[]>>((acc, route) => {
    (acc[route.section] ??= []).push(route);
    return acc;
  }, {});
  const title = kind === 'staff' ? 'Fintivio platform' : tenant?.name ?? 'Fintivio';

  return (
    <div className={cn('flex h-full flex-col border-r transition-all duration-300', isCollapsed ? 'w-16' : 'w-64')}>
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!isCollapsed && <h1 className="text-lg font-bold truncate" data-testid="workspace-name">{title}</h1>}
        <Button variant="ghost" size="icon" aria-label={isCollapsed ? 'Expand navigation' : 'Collapse navigation'} onClick={() => setIsCollapsed(!isCollapsed)}>
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </Button>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <nav aria-label="Main" className="flex-1 space-y-4 px-2 py-4">
          {Object.entries(sections).map(([section, items]) => (
            <div key={section} className="space-y-1">
              {!isCollapsed && <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section}</p>}
              {items.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  title={isCollapsed ? item.name : undefined}
                  className={({ isActive }) => cn(
                    isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    'group flex items-center rounded-md px-2 py-2 text-sm font-medium',
                    isCollapsed && 'justify-center',
                  )}
                >
                  <item.icon className={cn('h-5 w-5 flex-shrink-0', !isCollapsed && 'mr-3')} />
                  {!isCollapsed && item.name}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t p-4 space-y-4">
          <NavLink to="/app/me" className="flex items-center" title="My profile">
            <div className="h-8 w-8 flex-shrink-0 rounded-full bg-accent flex items-center justify-center">
              <span className="text-accent-foreground text-sm">{user?.email?.charAt(0).toUpperCase()}</span>
            </div>
            {!isCollapsed && (
              <div className="ml-3 min-w-0">
                <p className="text-sm font-medium truncate" data-testid="current-user">{user?.email}</p>
                <p className="text-xs text-muted-foreground truncate">{kind === 'staff' ? (user?.platformRoles ?? []).join(', ') : (user?.userTenants?.[0]?.roleNames ?? []).join(', ')}</p>
              </div>
            )}
          </NavLink>
          <Button variant="ghost" size="sm" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="w-full justify-start px-2">
            {theme === 'light' ? <Moon className="h-5 w-5 mr-3" /> : <Sun className="h-5 w-5 mr-3" />}
            {!isCollapsed && (theme === 'light' ? 'Dark Mode' : 'Light Mode')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void logout()}
            className={cn('flex items-center rounded-md px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground w-full', isCollapsed && 'justify-center')}
            title={isCollapsed ? 'Sign out' : undefined}
          >
            <LogOut className={cn('h-5 w-5', !isCollapsed && 'mr-3')} />
            {!isCollapsed && 'Sign out'}
          </Button>
        </div>
      </div>
    </div>
  );
}
