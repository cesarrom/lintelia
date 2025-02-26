import "reflect-metadata";
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { env } from "@/lib/constants";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { Providers } from "./providers";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Workflow Engine",
  description: "Enterprise workflow automation platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-screen w-screen" suppressHydrationWarning>
      <body className={`${inter.className} h-full w-full`}>
        <AuthProvider projectId={env.DESCOPE_PROJECT_ID}>
          <Providers>
            {children}
            <Toaster />
          </Providers>
        </AuthProvider>
      </body>
    </html>
  );
}
