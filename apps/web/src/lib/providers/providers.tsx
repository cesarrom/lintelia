'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as JotaiProvider } from 'jotai';
import { ReactNode, useState } from 'react';
import { ThemeProvider } from './ThemeProvider';
import { TenantProvider } from './TenantProvider';
import { AuthProvider as AP } from '../auth/AuthContext';
import { AuthProvider } from '@descope/react-sdk';

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
    <AuthProvider projectId={import.meta.env.VITE_DESCOPE_PROJECT_ID as string}>
      <JotaiProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <TenantProvider>
              <AP>
                {children}
              </AP>
            </TenantProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </JotaiProvider>
    </AuthProvider>
  );
} 