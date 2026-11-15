import { type ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useSession } from '@/lib/auth/session';

/** Sends visitors without a session to the sign-on page. Authorization itself is enforced by the API. */
export function RequireSession({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useSession();
  if (!isAuthenticated) return <Navigate to="/sign-on" replace />;
  return <>{children}</>;
}
