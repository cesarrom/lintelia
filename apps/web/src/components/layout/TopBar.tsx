import { Fragment, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ChevronRight, LayoutGrid, Moon, Search, Sun, UserRound } from 'lucide-react';
import { useBackOffice } from '@/back-office/runtime';
import { useLiveStatus } from '@/lib/live';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth/AuthContext';
import { useTheme } from '@/lib/providers/ThemeProvider';
import { memberRoutes, staffRoutes, type AppRoute } from '@/lib/routes/routes';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from '@/components/ui/command';

/** What a detail page under a list is called in the breadcrumb. */
const DETAIL: Record<string, string> = {
  '/app/cases': 'Case',
  '/app/tasks': 'Task',
  '/app/clients': 'Client',
  '/app/workflows': 'Editor',
  '/app/forms': 'Submissions',
};

function useRoutes() {
  const { kind, hasPermission } = useAuth();
  const { definition } = useBackOffice();
  const routes = (kind === 'staff' ? staffRoutes : memberRoutes).filter((r) => !r.permissions || hasPermission(r.permissions));
  if (kind === 'staff' || !definition) return routes;
  // The institution's own pages (its back office): their menu section, or "Back office" for pages reached by links.
  const sectionOf = (page: string) => definition.navigation.find((n) => n.page === page)?.section ?? 'Back office';
  const custom = Object.entries(definition.pages).filter(([, page]) => page.context === 'none').map(([key, page]) => ({
    name: definition.navigation.find((n) => n.page === key)?.label ?? page.title, href: `/app/x/${key}`, section: sectionOf(key), icon: LayoutGrid,
  }));
  return [...routes, ...custom];
}

function useCrumbs(routes: AppRoute[]) {
  const { pathname } = useLocation();
  if (pathname === '/app/me') return [{ label: 'Account' }, { label: 'Profile' }];
  const match = [...routes].sort((a, b) => b.href.length - a.href.length).find((r) => pathname === r.href || pathname.startsWith(`${r.href}/`));
  if (!match) return [];
  if (pathname === match.href) return [{ label: match.section }, { label: match.name }];
  const rest = pathname.slice(match.href.length + 1);
  const detail = rest === 'new' ? 'New' : DETAIL[match.href] ?? 'Details';
  return [{ label: match.section }, { label: match.name, href: match.href }, { label: detail }];
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** Top of the content panel: where you are, quick navigation (⌘K) and the theme switch. */
export function TopBar() {
  const routes = useRoutes();
  const crumbs = useCrumbs(routes);
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    navigate(href);
  };
  const sections = routes.reduce<Record<string, AppRoute[]>>((acc, r) => ((acc[r.section] ??= []).push(r), acc), {});

  return (
    <header className="sticky top-0 z-20 flex h-[52px] shrink-0 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6">
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px]">
        {crumbs.map((crumb, i) => (
          <Fragment key={i}>
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />}
            {crumb.href
              ? <Link to={crumb.href} className="truncate text-muted-foreground transition-colors hover:text-foreground">{crumb.label}</Link>
              : <span className={cn('truncate', i === crumbs.length - 1 ? 'font-medium text-foreground' : 'text-muted-foreground')}>{crumb.label}</span>}
          </Fragment>
        ))}
      </nav>

      <button
        type="button"
        aria-label="Jump to a page"
        onClick={() => setOpen(true)}
        className="group hidden h-8 w-64 items-center gap-2 rounded-lg border bg-muted/40 px-2.5 text-[13px] text-muted-foreground shadow-xs transition-colors hover:border-foreground/20 hover:bg-background md:flex"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Jump to…</span>
        <kbd className="rounded border bg-background px-1.5 font-sans text-[10.5px] font-medium text-muted-foreground">{isMac ? '⌘' : 'Ctrl'} K</kbd>
      </button>
      <LiveIndicator />
      <button
        type="button"
        aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
        title={theme === 'light' ? 'Dark theme' : 'Light theme'}
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Where to?" />
        <CommandList>
          <CommandEmpty>No page matches.</CommandEmpty>
          {Object.entries(sections).map(([section, items]) => (
            <CommandGroup key={section} heading={section}>
              {items.map((item) => (
                <CommandItem key={item.href} value={`${section} ${item.name}`} onSelect={() => go(item.href)}>
                  <item.icon className="text-muted-foreground" />
                  {item.name}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
          <CommandGroup heading="Account">
            <CommandItem value="account profile" onSelect={() => go('/app/me')}><UserRound className="text-muted-foreground" />Profile</CommandItem>
            <CommandItem value="theme dark light" onSelect={() => { setTheme(theme === 'light' ? 'dark' : 'light'); setOpen(false); }}>
              {theme === 'light' ? <Moon className="text-muted-foreground" /> : <Sun className="text-muted-foreground" />}
              {theme === 'light' ? 'Dark theme' : 'Light theme'}
              <CommandShortcut>Theme</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </header>
  );
}

/** Whether the screens update by themselves right now (docs/plans/17): live, or reconnecting (polling meanwhile). */
function LiveIndicator() {
  const status = useLiveStatus();
  if (status === 'off') return null;
  const live = status === 'connected';
  return (
    <span className="flex h-8 items-center gap-1.5 px-1.5 text-[11.5px] text-muted-foreground" data-testid="live-status" data-state={status}
      title={live ? 'Live: pages update as things happen' : 'Reconnecting… pages refresh every few seconds meanwhile'}>
      <span className={cn('h-2 w-2 rounded-full', live ? 'bg-success shadow-[0_0_0_3px_hsl(var(--success)/0.15)]' : 'animate-pulse bg-warning')} />
      <span className="hidden lg:inline">{live ? 'Live' : 'Reconnecting'}</span>
    </span>
  );
}
