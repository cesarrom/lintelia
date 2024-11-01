import './globals.css'
import { Inter } from 'next/font/google'
import { cn } from '@/lib/utils'
import { AuthProvider } from '@descope/nextjs-sdk'
import { env } from '@fintivio-sst/core/constants'
import { TenantFetcher } from '@/providers/tenant/tenant-fetcher'

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
  return (
    <AuthProvider projectId={env.DESCOPE_PROJECT_ID}>
      <TenantFetcher>
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
      </TenantFetcher>
    </AuthProvider>
  )
}