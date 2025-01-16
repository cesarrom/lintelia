import './globals.css'
import { Inter } from 'next/font/google'
import { cn } from '@/lib/utils'
import { AuthProvider } from '@descope/nextjs-sdk'
import { env } from '@fintivio-sst/core/constants'
import { getTenant } from '@/actions/tenants'
import { getUser } from '@/actions/users'
import { SessionProvider } from '@/providers/session.provider'

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

export default async function Layout({ children }: React.PropsWithChildren<unknown>) {
  const [tenant, user] = await Promise.all([
    getTenant(),
    getUser()
  ]);

  return (
    <AuthProvider projectId={env.DESCOPE_PROJECT_ID}>
      <SessionProvider user={user} tenant={tenant}>
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