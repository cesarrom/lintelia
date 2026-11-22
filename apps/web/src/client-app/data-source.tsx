import { createContext, useContext, type ReactNode } from 'react';
import { useAppData } from './live';
import type { AppData } from './types';

/**
 * Where pages get their data: the API for the signed-in client (live app), or data given by the studio (preview with
 * sample data or a real client's data). Components call `useSourcesData` and do not care which.
 */
export type SourcesHook = (sources: string[], key: string, options?: { refetchInterval?: number }) => { data: AppData | undefined; isLoading: boolean };

const SourcesContext = createContext<SourcesHook>(useAppData);

export function SourcesProvider({ hook, children }: { hook: SourcesHook; children: ReactNode }) {
  return <SourcesContext.Provider value={hook}>{children}</SourcesContext.Provider>;
}

export function useSourcesData(sources: string[], key: string, options?: { refetchInterval?: number }) {
  const hook = useContext(SourcesContext);
  return hook(sources, key, options);
}
