import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Loader2 } from 'lucide-react';
import { BUILTIN_PAGES, type BackOfficePage } from '@repo/lintelia/schemas';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState, PageContainer, PageHeader } from '@/components/app/page';
import { AppIcon } from '@/client-app/icons';
import { BackOfficeWidgets, useBackOffice, type BackOfficeContextValue } from './runtime';

/** A page of the back office (`/app/x/:page`); pages about a client or a case live in those pages' tabs instead. */
export function BackOfficePageRoute() {
  const { page: key = '' } = useParams();
  const [search] = useSearchParams();
  const { app, definition } = useBackOffice();
  const params = useMemo(() => Object.fromEntries(search.entries()), [search]);
  const page = definition?.pages[key];
  if (!app) return <PageContainer><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></PageContainer>;
  if (!page) return <PageContainer><EmptyState title="Page not found">This page does not exist, or it is not for you.</EmptyState></PageContainer>;
  const context: BackOfficeContextValue = page.context === 'client' ? { client: params.client } : page.context === 'case' ? { case: params.case } : {};
  return (
    <PageContainer>
      <PageHeader title={page.title} description={page.description} icon={undefined} />
      <BackOfficeWidgets widgets={page.widgets} page={key} context={context} params={params} />
    </PageContainer>
  );
}

/** Buttons the back office adds to a built-in page (client or case), each running an action with that record. */
export function SlotActions({ scope, context }: { scope: 'client' | 'case'; context: BackOfficeContextValue }) {
  const { definition, run, starting } = useBackOffice();
  const refs = definition?.slots[scope].actions ?? [];
  if (!refs.length) return null;
  return (
    <>
      {refs.map((ref) => {
        const action = definition!.actions[ref.action];
        if (!action) return null;
        return (
          <Button key={ref.action} variant="outline" onClick={() => void run(ref.action, context)} disabled={starting === ref.action} data-testid="slot-action" data-action={ref.action}>
            {starting === ref.action ? <Loader2 className="h-4 w-4 animate-spin" /> : <AppIcon name={action.icon} fallback="zap" className="h-4 w-4" />}{action.label}
          </Button>
        );
      })}
    </>
  );
}

/**
 * Tabs the back office adds to a built-in page: the page's own content stays the first tab ("Overview"), the
 * institution's pages about this record follow.
 */
export function SlotTabs({ scope, context, children }: { scope: 'client' | 'case'; context: BackOfficeContextValue; children: React.ReactNode }) {
  const { definition } = useBackOffice();
  const tabs = (definition?.slots[scope].tabs ?? []).filter((t) => definition?.pages[t.page]);
  const [tab, setTab] = useState('overview');
  if (!tabs.length) return <>{children}</>;
  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-6">
      <TabsList data-testid="slot-tabs">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        {tabs.map((t) => <TabsTrigger key={t.page} value={t.page}>{t.label}</TabsTrigger>)}
      </TabsList>
      <TabsContent value="overview" className="space-y-6">{children}</TabsContent>
      {tabs.map((t) => (
        <TabsContent key={t.page} value={t.page}>
          {tab === t.page && <BackOfficeWidgets widgets={(definition!.pages[t.page] as BackOfficePage).widgets} page={t.page} context={context} />}
        </TabsContent>
      ))}
    </Tabs>
  );
}

/** What the back office adds to the dashboard. */
export function DashboardSlot() {
  const { definition } = useBackOffice();
  const widgets = definition?.slots.dashboard ?? [];
  if (!widgets.length) return null;
  return <section data-testid="dashboard-slot"><BackOfficeWidgets widgets={widgets} slot="dashboard" /></section>;
}

/**
 * Homes (docs/plans/16 §5.2): after signing in, a member lands on the first home the back office gives them (already
 * pruned for them). Only the first visit of the dashboard in a browser session goes there; afterwards it stays put.
 */
export function useHomeRedirect() {
  const { definition } = useBackOffice();
  const navigate = useNavigate();
  useEffect(() => {
    const home = definition?.homes[0];
    if (!home || sessionStorage.getItem('lintelia.home-applied')) return;
    sessionStorage.setItem('lintelia.home-applied', '1');
    if (home.page) navigate(`/app/x/${home.page}`, { replace: true });
    else if (home.builtin && home.builtin !== 'dashboard') navigate(BUILTIN_PAGES[home.builtin].path, { replace: true });
  }, [definition, navigate]);
}
