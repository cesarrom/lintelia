import React from 'react'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100">
      <main className="w-full max-w-4xl px-4 py-8">
        {children}
      </main>
    </div>
  )
}
