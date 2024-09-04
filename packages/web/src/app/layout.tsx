// This is the root layout component for your Next.js app.
// Learn more: https://nextjs.org/docs/app/building-your-application/routing/pages-and-layouts#root-layout-required
import './globals.css'
import { Inter } from 'next/font/google'
import { cn } from '@/lib/utils'
import { AuthProvider } from '@descope/nextjs-sdk'
import { env } from '@fintivio-sst/core/constants'
import { SessionProvider } from '@/providers/session.provider'
import { headers } from 'next/headers';
import { getTenant } from '@/actions/tenants/getTenant'

const fontHeading = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-heading',
})

const fontBody = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
})

export default async function Layout({ children }: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = headers();
  // {tenant}.{env?}.fintivio.org/...
  const headerUrl = headersList.get('x-url') || "";

  const tenantName = headerUrl.split(".")[0];
  const tenant = await getTenant(tenantName);

  return (
    <AuthProvider projectId={env.DESCOPE_PROJECT_ID}>
      <SessionProvider
        session={{
          isAuthenticated: false,
          user: null,
          tenant,
        }}
      >
        <html lang="en">
          <body
            className={cn(
              'antialiased',
              fontHeading.variable,
              fontBody.variable
            )}
          >
            {children}
          </body>
        </html>
      </SessionProvider>
    </AuthProvider>
  )
}