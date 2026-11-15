import { Sidebar } from "@/components/layout/Sidebar";
import { Suspense } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { RequireSession } from "@/components/auth/RequireSession";
import { useSession } from "@/lib/auth/session";

/** Back-office shell for institution members and platform staff. Clients use the portal instead. */
export function AppLayout() {
  const { session } = useSession();
  const { pathname } = useLocation();
  const kind = session?.user.kind;
  if (kind === 'client') return <Navigate to="/portal" replace />;
  if (kind === 'staff' && !pathname.startsWith('/app/platform') && pathname !== '/app/me') {
    return <Navigate to="/app/platform/institutions" replace />;
  }
  return (
    <RequireSession>
      <div className="flex h-screen w-screen">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="min-h-full">
            <Suspense fallback={<div>Loading...</div>}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </RequireSession>
  );
}
