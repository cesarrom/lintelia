import { Suspense } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSession } from '@/lib/auth/session';
import { cn } from '@/lib/utils';

/** Client portal shell, branded with the institution's colours. Only clients use it. */
export function PortalLayout() {
  const { isAuthenticated, session } = useSession();
  const { logout } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    // Come back here after signing in (e.g. from a "review your application" e-mail link).
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/sign-on?client=1&next=${next}`} replace />;
  }
  if (session?.user.kind !== 'client') return <Navigate to="/app/dashboard" replace />;
  const tenant = session.tenant;

  const link = ({ isActive }: { isActive: boolean }) => cn('px-3 py-2 text-sm font-medium rounded-md', isActive ? 'bg-white/20' : 'hover:bg-white/10');
  return (
    <div className="min-h-screen bg-muted/30">
      <header style={{ background: tenant?.pallette.primary ?? '#0f172a' }} className="text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-lg font-semibold" data-testid="portal-brand">{tenant?.name}</span>
            <nav aria-label="Portal" className="flex gap-1">
              <NavLink to="/portal" end className={link}>My applications</NavLink>
              <NavLink to="/portal/requests" className={link}>Requests</NavLink>
              <NavLink to="/portal/privacy" className={link}>Privacy</NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline" data-testid="current-user">{session.user.email}</span>
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white" onClick={() => void logout()}>
              <LogOut className="mr-2 h-4 w-4" />Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Suspense fallback={<div>Loading…</div>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
