import { Sidebar } from "@/components/layout/Sidebar";
import { Suspense } from "react";
import { Outlet } from "react-router";

export function AppLayout() {
  return (
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
  );
}
