'use client';
import { Suspense } from 'react';

export const Wrapper = ({ children }: React.PropsWithChildren<unknown>) => (
  <Suspense fallback={
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100">
      <main className="w-full max-w-4xl px-4 py-8">
        Loading...
      </main>
    </div>
  }>
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100">
      <main className="w-full max-w-4xl px-4 py-8">
        {children}
      </main>
    </div>
  </Suspense>
);