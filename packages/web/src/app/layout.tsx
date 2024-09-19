import './globals.css'
import { Inter } from 'next/font/google'
import { cn } from '@/lib/utils'
import { AuthProvider } from '@descope/nextjs-sdk'
import { env } from '@fintivio-sst/core/constants'
import { SessionFetcher } from '@/providers/session/session-fetcher'
import { v4 as uuid } from 'uuid';
import { getSession } from '@/actions/session/getSession'
import { SessionProvider } from '@/providers/session/session.provider'

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
  const s = await getSession();
  return (
    <AuthProvider projectId={env.DESCOPE_PROJECT_ID}>
      <SessionProvider session={s}>
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