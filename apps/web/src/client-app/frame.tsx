import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { AppShell } from './AppShell';
import { LiveRuntime } from './live';
import { PageSkeleton } from './pages';
import type { AppView } from './types';

/** The portal when the institution published a client app: its shell, its runtime, the routed page inside. */
export default function ClientAppFrame({ app, base = '/portal', embedded, onSignOut }: { app: AppView; base?: string; embedded?: boolean; onSignOut?: () => void }) {
  return (
    <LiveRuntime app={app} base={base} onSignOut={onSignOut}>
      <AppShell embedded={embedded}>
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </AppShell>
    </LiveRuntime>
  );
}
