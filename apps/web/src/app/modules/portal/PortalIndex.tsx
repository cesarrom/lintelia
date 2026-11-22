import { lazy } from 'react';
import { useClientApp } from '@/client-app/app-query';

const PortalHomePage = lazy(() => import('./PortalHomePage'));
const ClientAppHome = lazy(() => import('@/client-app/pages').then((m) => ({ default: m.ClientAppPageRoute })));

/** `/portal`: the client app's home page when the institution published one, the classic portal home otherwise. */
export default function PortalIndex() {
  const { data: app } = useClientApp();
  return app?.available ? <ClientAppHome /> : <PortalHomePage />;
}
