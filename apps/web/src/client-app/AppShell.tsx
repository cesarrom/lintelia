import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, LogOut, MoreHorizontal } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, Monogram } from '@/components/brand/Monogram';
import { LogoMark } from '@/components/brand/Logo';
import { useAxios } from '@/lib/services/axios';
import { cn } from '@/lib/utils';
import { evaluate, useResolved } from './expressions';
import { AppIcon } from './icons';
import { useAppBase } from './live';
import { useSourcesData } from './data-source';
import { appThemeProps, pageScope, useRuntime } from './runtime';
import { NotificationRow, openNotification } from './widgets/process';
import { ConsentGate, missingConsents } from './ConsentGate';

const API_BASE_URL = import.meta.env.VITE_FILES_API_BASE_URL as string;

/** Records a navigation rule reads (`'customer' in me.segments` reads nothing but `me`). */
const navSources = (rules: Array<string | undefined>) => {
  const sources = new Set(['me', 'notifications']);
  for (const rule of rules) for (const m of (rule ?? '').matchAll(/records\.([a-z][a-z0-9_-]*)/g)) sources.add(`records:${m[1]}`);
  return [...sources];
};

/**
 * The client app's frame, in the institution's colours: navigation from the app definition (sidebar on large screens,
 * tab bar on phones), notifications, the signed-in client. `embedded`: inside the institution's site (SDK) — no
 * footer, compact header.
 */
export function AppShell({ children, embedded, chrome = 'full' }: { children: ReactNode; embedded?: boolean; chrome?: 'full' | 'none' }) {
  const runtime = useRuntime();
  const base = useAppBase();
  const location = useLocation();
  const { definition, institution } = runtime;
  const { data } = useSourcesData(navSources(definition.navigation.map((n) => n.visibleIf)), '__shell', { refetchInterval: 20_000 });
  const scope = pageScope(data, {});
  const visible = useResolved(async () => Promise.all(definition.navigation.map(async (n) => (n.visibleIf?.trim() ? Boolean(await evaluate(n.visibleIf, scope, scope)) : true))), [definition.navigation, scope]);
  const items = definition.navigation.filter((_, i) => (visible ? visible[i] : !definition.navigation[i].visibleIf));
  const [more, setMore] = useState(false);
  const me = data?.me;
  // Live app: required terms first (the preview never blocks).
  const gate = runtime.mode === 'live' && me && missingConsents(definition, me).length > 0;
  const content = gate ? <ConsentGate me={me!} /> : children;
  const brandHeader = definition.theme?.header === 'brand';
  // An app designed for one colour scheme keeps it, whatever the device prefers (the studio preview follows the app too).
  const scheme = definition.theme?.colorScheme;
  useEffect(() => {
    if (!scheme || scheme === 'auto') return;
    const root = document.documentElement;
    const wasDark = root.classList.contains('dark');
    root.classList.toggle('dark', scheme === 'dark');
    return () => { root.classList.toggle('dark', wasDark); };
  }, [scheme]);

  const pathOf = (page: string) => (page === definition.home ? base : `${base}/p/${page}`);
  const isActive = (page: string) => {
    const path = location.pathname.replace(/\/$/, '');
    if (page === definition.home) return path === base;
    return path === `${base}/p/${page}`;
  };
  const tabs = items.slice(0, 4);
  const overflow = items.slice(4);

  // Content only (embedded, the host site navigates): no menu, no header; the frame takes the content's height.
  if (chrome === 'none') {
    return (
      <div className="bg-canvas" {...appThemeProps(definition, institution)} data-testid="client-app" data-chrome="none">
        <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">{content}</main>
      </div>
    );
  }

  const navItem = (item: (typeof items)[number], variant: 'side' | 'sheet') => (
    <NavLink
      key={item.page} to={pathOf(item.page)} onClick={() => setMore(false)} data-testid="app-nav" data-page={item.page}
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-medium transition-colors',
        isActive(item.page)
          ? brandHeader && variant === 'side' ? 'bg-white/15 text-white' : 'bg-primary-soft text-primary'
          : brandHeader && variant === 'side' ? 'text-white/75 hover:bg-white/10 hover:text-white' : 'text-foreground/70 hover:bg-foreground/[0.04] hover:text-foreground',
      )}
    >
      <AppIcon name={item.icon} fallback="circle" className="h-[18px] w-[18px]" />{item.label}
    </NavLink>
  );

  return (
    <div className="min-h-screen bg-canvas" {...appThemeProps(definition, institution)} data-testid="client-app">
      {/* Sidebar (large screens) */}
      <aside className={cn('fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r lg:flex', brandHeader ? 'border-transparent bg-primary text-white' : 'bg-background')}>
        <div className="flex h-16 items-center gap-2.5 px-5">
          <Brand institution={institution} light={brandHeader} logoUrl={definition.theme?.logoUrl} />
        </div>
        <nav aria-label="App" className="flex-1 space-y-1 overflow-y-auto px-3 py-3">{items.map((item) => navItem(item, 'side'))}</nav>
        {me && (
          <div className={cn('m-3 flex items-center gap-2.5 rounded-xl p-2.5', brandHeader ? 'bg-white/10' : 'border bg-card')}>
            <Avatar name={me.name} email={me.email} size="sm" className="h-8 w-8 ring-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium" data-testid="app-user">{me.name}</p>
              <p className={cn('truncate text-[11.5px]', brandHeader ? 'text-white/70' : 'text-muted-foreground')}>{me.email}</p>
            </div>
            {runtime.signOut && (
              <button type="button" onClick={runtime.signOut} aria-label="Sign out" title="Sign out" className={cn('rounded-lg p-1.5 transition-colors', brandHeader ? 'hover:bg-white/15' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </aside>

      <div className="lg:pl-64">
        {/* Top bar */}
        <header className={cn('sticky top-0 z-20 border-b backdrop-blur', brandHeader ? 'border-transparent bg-primary/95 text-white lg:bg-background/85 lg:text-foreground lg:border-border' : 'bg-background/85 supports-[backdrop-filter]:bg-background/70')}>
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-2.5 lg:hidden"><Brand institution={institution} light={brandHeader} logoUrl={definition.theme?.logoUrl} /></div>
            <p className="hidden text-[13px] text-muted-foreground lg:block">{me ? `Hello, ${me.firstName}` : ''}</p>
            <div className="flex items-center gap-1.5">
              <NotificationsBell notifications={data?.notifications ?? []} />
              {me && <span className="hidden sm:block lg:hidden"><Avatar name={me.name} email={me.email} size="xs" className="h-7 w-7 ring-0" /></span>}
            </div>
          </div>
        </header>

        <main className={cn('mx-auto w-full max-w-5xl px-4 pb-28 pt-6 sm:px-6 sm:pt-8 lg:pb-12')}>{content}</main>

        {!embedded && (
          <footer className="mx-auto hidden max-w-5xl items-center justify-between gap-2 px-6 pb-8 text-[12px] text-muted-foreground lg:flex">
            <span>{institution.name}</span>
            <span className="inline-flex items-center gap-1.5"><LogoMark className="h-3.5 w-3.5" />Secured by fintivio</span>
          </footer>
        )}
      </div>

      {/* Tab bar (phones, tablets) */}
      <nav aria-label="App tabs" className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-xl" style={{ gridTemplateColumns: `repeat(${tabs.length + (overflow.length ? 1 : 0)}, minmax(0, 1fr))` }}>
          {tabs.map((item) => (
            <NavLink key={item.page} to={pathOf(item.page)} data-testid="app-tab" data-page={item.page} className={cn('flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium', isActive(item.page) ? 'text-primary' : 'text-muted-foreground')}>
              <AppIcon name={item.icon} fallback="circle" className="h-5 w-5" />{item.label}
            </NavLink>
          ))}
          {overflow.length > 0 && (
            <button type="button" onClick={() => setMore(true)} className={cn('flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium', overflow.some((i) => isActive(i.page)) ? 'text-primary' : 'text-muted-foreground')} data-testid="app-tab-more">
              <MoreHorizontal className="h-5 w-5" />More
            </button>
          )}
        </div>
      </nav>
      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-8" {...appThemeProps(definition, institution)}>
          <SheetHeader><SheetTitle>More</SheetTitle></SheetHeader>
          <div className="mt-3 space-y-1">
            {overflow.map((item) => navItem(item, 'sheet'))}
            {runtime.signOut && (
              <button type="button" onClick={runtime.signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-medium text-foreground/70 hover:bg-foreground/[0.04]"><LogOut className="h-[18px] w-[18px]" />Sign out</button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Brand({ institution, light, logoUrl }: { institution: { name: string; pallette?: { primary?: string } | null; logoUrl?: string | null }; light?: boolean; logoUrl?: string }) {
  const logo = logoUrl || null;
  return (
    <>
      {logo ? <img src={logo} alt="" className="h-8 w-8 rounded-lg object-contain" /> : <Monogram name={institution.name} color={light ? '#ffffff33' : institution.pallette?.primary} size="sm" className="h-8 w-8" />}
      <span className="truncate text-[15px] font-semibold tracking-tight" data-testid="app-brand">{institution.name}</span>
    </>
  );
}

function NotificationsBell({ notifications }: { notifications: Array<import('./types').NotificationView> }) {
  const runtime = useRuntime();
  const { axios } = useAxios();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;
  const onOpenChange = async (next: boolean) => {
    setOpen(next);
    if (!next && unread > 0 && runtime.mode === 'live') {
      await axios.post(`${API_BASE_URL}/me/app/notifications/read`, {}).catch(() => undefined);
      await queryClient.invalidateQueries({ queryKey: ['client-app', 'data'] });
    }
  };
  return (
    <Popover open={open} onOpenChange={(o) => void onOpenChange(o)}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Notifications${unread ? ` (${unread} new)` : ''}`} className="relative rounded-full p-2 text-current opacity-80 transition hover:bg-foreground/[0.06] hover:opacity-100" data-testid="notifications-bell">
          <Bell className="h-5 w-5" />
          {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white" data-testid="unread-count">{unread}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0" {...appThemeProps(runtime.definition, runtime.institution)}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && <span className="text-xs text-muted-foreground">{unread} new</span>}
        </div>
        {notifications.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted-foreground">No messages yet.</p> : (
          <ul className="max-h-[420px] divide-y overflow-y-auto">
            {notifications.slice(0, 12).map((n) => <NotificationRow key={n.id} notification={n} compact onOpen={() => { void onOpenChange(false); openNotification(runtime, n); }} />)}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
