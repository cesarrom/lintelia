import { useEffect, useRef } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/app/page';
import { AppPageView, pageScope, sourcesOf, useMaybeRuntime, useRuntime } from './runtime';
import { useAppBase } from './live';
import { useSourcesData } from './data-source';
import { JourneyRunner } from './JourneyRunner';

/** A page of the client app (`/portal` is the home page, `/portal/p/:page?key=…` the others). */
export function ClientAppPageRoute() {
  return useMaybeRuntime() ? <AppPage /> : <Navigate to="/portal" replace />;
}

export function ClientJourneyRoute() {
  return useMaybeRuntime() ? <Journey /> : <Navigate to="/portal" replace />;
}

/**
 * A link that starts a journey (docs/plans/14): `/portal/start/pay-qr?amount=12` from an e-mail, a printed QR code, a
 * push notification. Signed-out clients sign in first and come back here. The query is the journey's input (the API
 * keeps its declared inputs only); the home page shows under a journey that opens over the page.
 */
export function ClientStartJourneyRoute() {
  return useMaybeRuntime() ? <StartJourney /> : <Navigate to="/portal" replace />;
}

function StartJourney() {
  const { journey } = useParams();
  const [search] = useSearchParams();
  const runtime = useRuntime();
  const navigate = useNavigate();
  const base = useAppBase();
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !journey) return;
    started.current = true;
    const input = Object.fromEntries(search.entries());
    const presentation = search.get('presentation');
    delete input.presentation;
    navigate(base, { replace: true });
    void runtime.startJourney(journey, input, presentation && ['page', 'dialog', 'sheet', 'fullscreen'].includes(presentation) ? { presentation: presentation as 'page' } : {});
  }, [journey]); // eslint-disable-line react-hooks/exhaustive-deps
  return <PageSkeleton />;
}

function AppPage() {
  const { page: pageKey } = useParams();
  const [search] = useSearchParams();
  const runtime = useRuntime();
  const key = pageKey ?? runtime.definition.home;
  const page = runtime.definition.pages[key];
  const params = Object.fromEntries(search.entries());
  const { data, isLoading } = useSourcesData(sourcesOf(page), key);

  if (!page) return <EmptyState art="search" title="Page not found">This page does not exist (any more).</EmptyState>;
  if (isLoading && !data) return <PageSkeleton />;
  return <AppPageView key={key} page={page} scope={pageScope(data, params)} />;
}

function Journey() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const base = useAppBase();
  return <JourneyRunner key={caseId} caseId={caseId!} onLeave={() => navigate(base)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-40 w-full rounded-3xl" />
      <div className="grid gap-4 sm:grid-cols-3"><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-28 rounded-2xl" /></div>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}
