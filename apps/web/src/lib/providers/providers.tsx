'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as JotaiProvider } from 'jotai';
import { ReactNode, useState } from 'react';
import { ThemeProvider } from './ThemeProvider';
import { TenantProvider } from './TenantProvider';
import { AuthProvider as AP } from '../auth/AuthContext';
import { SessionProvider } from '../auth/session';
import { LiveProvider } from '../live';
import { Toaster } from '@/components/ui/sonner';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <SessionProvider>
      <JotaiProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <TenantProvider>
              <AP>
                {/* Live updates (docs/plans/17): one stream per tab, following the session. */}
                <LiveProvider>
                  {children}
                </LiveProvider>
              </AP>
              <Toaster richColors closeButton />
            </TenantProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </JotaiProvider>
    </SessionProvider>
  );
} 