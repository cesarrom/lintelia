// This is the root layout component for your Next.js app.
// Learn more: https://nextjs.org/docs/app/building-your-application/routing/pages-and-layouts#root-layout-required
import './globals.css'
import { Inter } from 'next/font/google'
import { cn } from '@/lib/utils'
import { AuthProvider } from '@descope/nextjs-sdk'
import { env } from '@/lib/constants'

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

export default function Layout({ children }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthProvider projectId={env.DESCOPE_PROJECT_ID}>
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
    </AuthProvider>
  )
}