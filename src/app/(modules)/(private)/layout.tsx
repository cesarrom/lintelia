import { Sidebar } from "@/components/layout/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
