import { Sidebar } from "@/components/layout/Sidebar";
import { env } from "@/lib/constants";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { Providers } from "@/app/providers";
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <AuthProvider projectId={env.DESCOPE_PROJECT_ID}>
        <div className="flex h-screen w-screen">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-gray-100">
            <div className="min-h-full">
              {children}
            </div>
          </main>
        </div>
      </AuthProvider>
    </Providers>
  );
}
