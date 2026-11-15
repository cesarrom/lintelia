'use client';

import { cn } from '@/lib/utils';
import {
  LogOut,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from '@/components/ui/link';
import { routes } from '@/lib/routes/routes';
import { routeIcons } from '@/lib/routes/routeIcons';
import { useNavigate } from 'react-router';
import { useTheme } from '@/lib/providers/ThemeProvider';
import { PermissionGate } from '../auth/PermissionGate';

const navigation = routes.map((route) => ({
  ...route,
  icon: routeIcons[route.name as keyof typeof routeIcons],
}));

export function Sidebar() {
  const pathname = window.location.pathname;
  const router = useNavigate();
  const { isAuthenticated, user, tenant: tenantObj, logout } = useAuth();
  const tenant = tenantObj?.domain;
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { theme, setTheme } = useTheme();

  if (!isAuthenticated) return null;

  const handleLogout = async () => {
    try {
      await logout();
      router('/login');
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  return (
    <div className={cn(
      "flex h-full flex-col border-r transition-all duration-300",
      isCollapsed ? "w-16" : "w-64"
    )}>
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!isCollapsed && (
          <h1 className="text-xl font-bold truncate">
            {tenant ? tenant.charAt(0).toUpperCase() + tenant.slice(1) : 'Workflow Engine'}
          </h1>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hover:text-foreground"
          groups={['navigation']}
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </Button>
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
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  'group flex items-center rounded-md px-2 py-2 text-sm font-medium',
                  isCollapsed && 'justify-center'
                )}
                title={isCollapsed ? item.name : undefined}
                groups={['navigation']}
              >
                <item.icon
                  className={cn(
                    isActive
                      ? 'text-accent-foreground'
                      : 'text-muted-foreground group-hover:text-accent-foreground',
                    'h-5 w-5 flex-shrink-0',
                    !isCollapsed && 'mr-3'
                  )}
                />
                {!isCollapsed && item.name}
              </Link>
            );

            return item.permission ? (
              <PermissionGate key={item.name} permissions={[item.permission]}>
                <MenuItem />
              </PermissionGate>
            ) : (
              <MenuItem key={item.name} />
            );
          })}
        </nav>
        <div className="border-t p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center">
                  <span className="text-accent-foreground text-sm">
                    {user?.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
              {!isCollapsed && (
                <div className="ml-3">
                  <p className="text-sm font-medium truncate">
                    {user?.email}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="w-full justify-start px-2"
              groups={['theme']}
            >
              {theme === 'light' ? (
                <>
                  <Moon className="h-5 w-5 mr-3" />
                  {!isCollapsed && "Dark Mode"}
                </>
              ) : (
                <>
                  <Sun className="h-5 w-5 mr-3" />
                  {!isCollapsed && "Light Mode"}
                </>
              )}
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className={cn(
              "flex items-center rounded-md px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground w-full",
              isCollapsed && "justify-center"
            )}
            title={isCollapsed ? "Sign out" : undefined}
            groups={['auth']}
          >
            <LogOut className={cn("h-5 w-5", !isCollapsed && "mr-3")} />
            {!isCollapsed && "Sign out"}
          </Button>
        </div>
      </div>
    </div>
  );
}