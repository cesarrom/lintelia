import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { Suspense } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router";
import { ArrowLeft, Map as MapIcon } from "lucide-react";
import { RequireSession } from "@/components/auth/RequireSession";
import { PageLoader } from "@/components/app/loading";
import { useSession } from "@/lib/auth/session";
import { BackOfficeProvider } from "@/back-office/runtime";
import { LiveTeam } from "@/components/live/LiveTeam";

/**
 * Back-office shell for institution members and platform staff (clients use the portal instead): the navigation on
 * the canvas colour, the page in an inset panel with the top bar.
 */
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
      {/* The institution's own back office (docs/plans/16): its menu items, pages, additions and actions. */}
      <BackOfficeProvider>
      <LiveTeam />
      <div className="flex h-screen w-screen overflow-hidden bg-canvas">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col py-2 pr-2">
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-background shadow-card">
            <TopBar />
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Suspense fallback={<PageLoader />}>
                <Outlet />
              </Suspense>
            </div>
            <BackToMap />
          </main>
        </div>
      </div>
      </BackOfficeProvider>
    </RequireSession>
  );
}

/** Editors opened from the experience map (`?from=map`) offer the way back to where the map was. */
function BackToMap() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  if (pathname === "/app/map" || new URLSearchParams(search).get("from") !== "map") return null;
  return (
    <button
      type="button" onClick={() => navigate("/app/map")} data-testid="back-to-map"
      className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-foreground px-4 py-2 text-[13px] font-medium text-background shadow-raised transition hover:scale-[1.02]"
    >
      <ArrowLeft className="h-4 w-4" /><MapIcon className="h-4 w-4" />Back to the map
    </button>
  );
}
