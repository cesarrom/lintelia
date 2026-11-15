import { Suspense } from "react";
import { Outlet } from "react-router";
import { RequireSession } from "@/components/auth/RequireSession";

export function OnboardingLayout() {
  return (
    <RequireSession>
    <div className="flex h-screen w-screen">
      <main className="flex-1 overflow-y-auto bg-card">
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
