import { Link, useLocation } from 'react-router';
import { AlertTriangle, AppWindow, Check, CircleCheck, History, Loader2, PanelsTopLeft, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatRelative } from '@/components/app/page';
import { useAuth } from '@/lib/auth/AuthContext';
import { cn } from '@/lib/utils';

/** Pieces shared by the studio's two modes: the client app and the back office (docs/plans/11, 16). */
export interface VersionedApp { activeVersion: number | null; versions: Array<{ version: number; publishedAt: string; publishedBy: string }> }

/** Client app ↔ back office, for designers of both (others see `fallback`). */
export function StudioModeSwitch({ fallback = null }: { fallback?: React.ReactNode }) {
  const { hasPermission } = useAuth();
  const { pathname } = useLocation();
  if (!hasPermission('experience:read') || !hasPermission('backoffice:read')) return <>{fallback}</>;
  const modes = [
    { href: '/app/experience', label: 'Client app', icon: AppWindow },
    { href: '/app/back-office', label: 'Back office', icon: PanelsTopLeft },
  ];
  return (
    <nav className="inline-flex rounded-lg border bg-muted/40 p-0.5" aria-label="Studio mode" data-testid="studio-mode">
      {modes.map((m) => (
        <Link key={m.href} to={m.href} aria-current={pathname.startsWith(m.href) ? 'page' : undefined}
          className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors', pathname.startsWith(m.href) ? 'bg-background text-primary shadow-xs ring-1 ring-border' : 'text-muted-foreground hover:text-foreground')}>
          <m.icon className="h-3.5 w-3.5" />{m.label}
        </Link>
      ))}
    </nav>
  );
}

export function SaveIndicator({ state, readOnly }: { state: 'saved' | 'dirty' | 'saving' | 'error'; readOnly: boolean }) {
  if (readOnly) return <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Read only</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="save-state" data-state={state}>
      {state === 'saving' || state === 'dirty' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : state === 'error' ? <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> : <Check className="h-3.5 w-3.5 text-success" />}
      {state === 'saved' ? 'Draft saved' : state === 'error' ? 'Not saved' : 'Saving…'}
    </span>
  );
}

export function ProblemsButton({ errors }: { errors: string[] }) {
  if (!errors.length) return <span className="inline-flex items-center gap-1.5 px-2 text-xs font-medium text-success" data-testid="app-valid"><CircleCheck className="h-4 w-4" />Ready to publish</span>;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" data-testid="app-problems"><AlertTriangle className="h-4 w-4" />{errors.length} {errors.length === 1 ? 'problem' : 'problems'}</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[420px] p-0">
        <p className="border-b px-4 py-2.5 text-sm font-semibold">Fix these before publishing</p>
        <ul className="max-h-80 space-y-1.5 overflow-y-auto p-3 text-sm" data-testid="problems-list">{errors.map((e) => <li key={e} className="flex gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />{e}</li>)}</ul>
      </PopoverContent>
    </Popover>
  );
}

export function VersionsMenu({ app, canPublish, canManage, onActivate, onRestore }: { app: VersionedApp; canPublish: boolean; canManage: boolean; onActivate: (v: number) => void; onRestore: (v: number) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" data-testid="versions"><History className="h-4 w-4" />{app.activeVersion ? `Live: v${app.activeVersion}` : 'Not published'}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Versions</DropdownMenuLabel>
        {!app.versions.length && <p className="px-2 py-3 text-sm text-muted-foreground">Nothing published yet.</p>}
        {app.versions.map((v) => (
          <div key={v.version} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5" data-testid="version" data-version={v.version}>
            <div className="min-w-0">
              <p className="text-sm font-medium">Version {v.version}{app.activeVersion === v.version && <span className="ml-2 rounded-full bg-success-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-success">Live</span>}</p>
              <p className="truncate text-xs text-muted-foreground">{v.publishedBy} · {formatRelative(v.publishedAt)}</p>
            </div>
            <span className="flex shrink-0 gap-1">
              {canManage && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onRestore(v.version)}>Edit</Button>}
              {canPublish && app.activeVersion !== v.version && <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onActivate(v.version)} data-testid="make-live">Make live</Button>}
            </span>
          </div>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="text-xs">“Make live” rolls back without touching the draft.</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Hint({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="p-6 text-center">
      <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary"><Icon className="h-5 w-5" /></span>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

