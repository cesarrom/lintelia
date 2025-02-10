import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { env } from "@/lib/constants";
import { AuthProvider } from "@/lib/auth/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Workflow Engine",
  description: "Enterprise workflow automation platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className={`${inter.className} h-full`}>
        <AuthProvider projectId={env.DESCOPE_PROJECT_ID}>
          <div className="flex h-full">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
