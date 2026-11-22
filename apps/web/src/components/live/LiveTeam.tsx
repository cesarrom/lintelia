import { toast } from 'sonner';
import { useAuth } from '@/lib/auth/AuthContext';
import { useLive, useLiveInvalidate } from '@/lib/live';

/**
 * The back office listens for what concerns the member (docs/plans/17 §4.7): their tasks and their roles' queues
 * (task lists, counters, the dashboard and the screens waiting for them refresh as cases move), every case change for
 * members who read cases (lists, boards), and the messages workflows send them (shown as they arrive).
 */
export function LiveTeam() {
  const { user, kind, hasPermission } = useAuth();
  const me = kind === 'member' ? user?.userId : null;
  const roles = kind === 'member' ? user?.userTenants?.[0]?.roleNames ?? [] : [];
  const work = me ? [`member/${me}`, ...roles.map((r) => `queue/${r}`)] : [];
  useLiveInvalidate(work, [['tasks'], ['backoffice', 'screens'], ['backoffice', 'data']]);
  useLiveInvalidate(me && hasPermission('cases:read') ? ['cases'] : [], [['cases', 'list'], ['cases', 'pipelines'], ['backoffice', 'data']], 400);
  useLive(me ? [`member/${me}/messages`, ...roles.map((r) => `queue/${r}/messages`)] : [], (event) => {
    if (event.kind !== 'message') return;
    const { text, title, body, tone } = event.payload as { text?: string; title?: string; body?: string; tone?: string };
    const headline = String(title ?? text ?? 'New message');
    const description = title ? (body ?? text) : body;
    const show = tone === 'success' ? toast.success : tone === 'warning' ? toast.warning : toast.info;
    show(headline, { description: description ? String(description) : undefined });
  });
  return null;
}
