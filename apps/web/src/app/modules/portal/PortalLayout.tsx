import { Suspense, lazy } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSession } from '@/lib/auth/session';
import { useApiQuery } from '@/lib/services/api';
import { brandProps } from '@/lib/brand';
import { cn } from '@/lib/utils';
import { Avatar, Monogram } from '@/components/brand/Monogram';
import { LogoMark } from '@/components/brand/Logo';
import { Skeleton } from '@/components/ui/skeleton';
import { FullScreenLoader } from '@/components/app/loading';
import { useClientApp } from '@/client-app/app-query';
import type { ClientRequest } from './RequestCard';

const ClientAppFrame = lazy(() => import('@/client-app/frame'));

/**
 * Client portal shell, in the institution's colours. Only clients use it. When the institution published a client app
 * (docs/plans/11), the app's own shell and navigation take over; otherwise the classic portal (applications, requests,
 * privacy) is shown.
 */
export function PortalLayout() {
  const { isAuthenticated, session } = useSession();
  const { logout } = useAuth();
  const location = useLocation();
  const isClient = isAuthenticated && session?.user.kind === 'client';
  const app = useClientApp(isClient);
  const { data: requests = [] } = useApiQuery<ClientRequest[]>(['portal', 'requests'], isClient && app.data?.available === false ? '/me/requests' : null, { refetchInterval: 5000 });
  if (!isAuthenticated) {
    // Come back here after signing in (e.g. from a "review your application" e-mail link).
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/sign-on?client=1&next=${next}`} replace />;
  }
  if (session?.user.kind !== 'client') return <Navigate to="/app/dashboard" replace />;
  if (app.isLoading) return <FullScreenLoader />;
  if (app.data?.available) {
    return (
      <Suspense fallback={<FullScreenLoader />}>
        <ClientAppFrame app={app.data} />
      </Suspense>
    );
  }
  const tenant = session.tenant;
  const waiting = requests.filter((r) => r.status === 'open').length;

  const link = ({ isActive }: { isActive: boolean }) => cn(
    'inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-medium transition-colors',
    isActive ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground',
  );
  return (
    <div className="flex min-h-screen flex-col bg-canvas" {...brandProps(tenant?.pallette?.primary)}>
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex min-h-16 max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3 sm:flex-nowrap sm:py-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2">
            <span className="flex min-w-0 items-center gap-2.5">
              <Monogram name={tenant?.name} color={tenant?.pallette?.primary} size="sm" className="h-8 w-8" />
              <span className="truncate text-[15px] font-semibold tracking-tight" data-testid="portal-brand">{tenant?.name}</span>
            </span>
            <nav aria-label="Portal" className="-ml-3 flex w-full items-center gap-1 overflow-x-auto sm:ml-0 sm:w-auto">
              <NavLink to="/portal" end className={({ isActive }) => link({ isActive: isActive || location.pathname.startsWith('/portal/cases') })}>My applications</NavLink>
              <NavLink to="/portal/requests" className={link}>
                {({ isActive }) => (
                  <>Requests{waiting > 0 && <span className={cn('rounded-full px-1.5 text-[11px] font-semibold tabular', isActive ? 'bg-white/25' : 'bg-warning text-white')}>{waiting}</span>}</>
                )}
              </NavLink>
              <NavLink to="/portal/privacy" className={link}>Privacy</NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden items-center gap-2 rounded-full border bg-background py-1 pl-1 pr-3 md:flex">
              <Avatar name={(session.user as { name?: string }).name} email={session.user.email} size="xs" className="h-6 w-6 ring-0" />
              <span className="max-w-[200px] truncate text-[13px]" data-testid="current-user">{session.user.email}</span>
            </span>
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:py-10">
        <Suspense fallback={<div className="space-y-4"><Skeleton className="h-40 w-full rounded-2xl" /><Skeleton className="h-20 w-full rounded-xl" /></div>}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="border-t bg-background/60">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-5 py-5 text-[12px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><LogoMark className="h-4 w-4" />Secured by fintivio</span>
          <span>Documents are checked for malware before anyone opens them · Every access is recorded</span>
        </div>
      </footer>
    </div>
  );
}
