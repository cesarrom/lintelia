import { session } from "@descope/nextjs-sdk/server"

import { redirect } from 'next/navigation'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const sessionData = session()

  if (!sessionData) {
    redirect('/sign-on')
  }

  return <>{children}</>
}
