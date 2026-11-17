import { useApiQuery } from '@/lib/services/api';
import type { AppView } from './types';

/**
 * The published client app of the institution (`available: false` without one: the classic portal is used). Kept
 * apart from the runtime so the portal can ask without loading it.
 */
export function useClientApp(enabled = true) {
  return useApiQuery<AppView>(['client-app', 'app'], enabled ? '/me/app' : null, { refetchInterval: 60_000 });
}
