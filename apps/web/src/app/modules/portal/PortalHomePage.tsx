import { useNavigate } from 'react-router';
import { ArrowRight, BellRing, ChevronRight, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, StatusBadge, formatDate, formatRelative } from '@/components/app/page';
import { PortalWelcomeArt } from '@/components/brand/scenes';
import { useSession } from '@/lib/auth/session';
import { useApiQuery } from '@/lib/services/api';
import { cn } from '@/lib/utils';
import type { ClientRequest } from './RequestCard';

interface MyCase {
  id: string;
  reference: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const CLIENT_STATUS: Record<string, string> = {
  submitted: 'Received',
  in_progress: 'In progress',
  in_review: 'Under review',
  pending_client: 'Waiting for you',
  approved: 'Approved',
  rejected: 'Not approved',
  closed: 'Closed',
};

export const clientStatus = (status: string) => CLIENT_STATUS[status] ?? status;

/** How far along an application is, for the progress bar (0–100). */
export const clientProgress = (status: string) =>
  ({ submitted: 20, in_progress: 45, pending_client: 55, in_review: 75, approved: 100, rejected: 100, closed: 100 } as Record<string, number>)[status] ?? 30;

/** My applications and anything waiting for me. */
export default function PortalHomePage() {
  const navigate = useNavigate();
  const { session } = useSession();
  const { data: cases = [], isLoading } = useApiQuery<MyCase[]>(['portal', 'cases'], '/me/cases', { refetchInterval: 5000 });
  const { data: requests = [] } = useApiQuery<ClientRequest[]>(['portal', 'requests'], '/me/requests', { refetchInterval: 5000 });
  const waiting = requests.filter((r) => r.status === 'open');
  const name = (session?.user as { name?: string } | undefined)?.name?.split(' ')[0];
  const active = cases.filter((c) => !['approved', 'rejected', 'closed'].includes(c.status)).length;

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-primary text-primary-foreground shadow-raised">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_120%_at_100%_0%,rgba(255,255,255,0.22),transparent_60%),radial-gradient(60%_90%_at_0%_100%,rgba(0,0,0,0.25),transparent_60%)]" />
        <div className="relative grid items-center gap-6 p-7 sm:p-9 md:grid-cols-[1fr_240px]">
          <div>
            <p className="text-[13px] font-medium opacity-75">Welcome back{name ? `, ${name}` : ''}</p>
            <p className="mt-1.5 text-[28px] font-semibold leading-tight tracking-[-0.02em] sm:text-[32px]">
              {waiting.length ? 'We need something from you' : active ? 'Your applications are moving' : 'Everything in one place'}
            </p>
            <p className="mt-2 max-w-md text-[14.5px] leading-relaxed opacity-80">
              {waiting.length
                ? `${waiting.length === 1 ? 'One request is' : `${waiting.length} requests are`} waiting for you. It only takes a few minutes.`
                : active
                  ? `${active} ${active === 1 ? 'application is' : 'applications are'} in progress. We will e-mail you when anything changes.`
                  : 'Follow your applications, answer requests and manage your data here.'}
            </p>
            {waiting.length > 0 && (
              <Button onClick={() => navigate('/portal/requests')} className="mt-5 bg-white text-foreground shadow-raised hover:bg-white/90">
                <BellRing className="h-4 w-4" />Answer now<ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
          <PortalWelcomeArt color="hsl(var(--primary))" className="hidden w-[240px] md:block" />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <h1 className="text-xl font-semibold tracking-tight">My applications</h1>
          {cases.length > 0 && <span className="text-[13px] text-muted-foreground">{cases.length} in total</span>}
        </div>
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
        ) : cases.length === 0 ? (
          <EmptyState art="documents" title="Nothing here yet">You have no applications yet.</EmptyState>
        ) : (
          <div className="grid gap-3">
            {cases.map((c) => {
              const progress = clientProgress(c.status);
              const waitingForMe = c.status === 'pending_client' || waiting.some((r) => r.case?.id === c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => navigate(`/portal/cases/${c.id}`)}
                  data-testid="portal-case"
                  data-case-reference={c.reference}
                  className="group flex w-full items-center gap-4 rounded-2xl border bg-card p-4 text-left shadow-card transition hover:-translate-y-px hover:border-primary/30 hover:shadow-raised sm:p-5"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><FileText className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground"><span className="font-mono">{c.reference}</span> · submitted {formatDate(c.createdAt)} · updated {formatRelative(c.updatedAt)}</p>
                    <div className="mt-2.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
                      <span className={cn('block h-full rounded-full', c.status === 'rejected' ? 'bg-muted-foreground/50' : waitingForMe ? 'bg-warning' : 'bg-primary')} style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                  <StatusBadge status={c.status} label={clientStatus(c.status)} />
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
