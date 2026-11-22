import { cn } from '@/lib/utils';
import { LogoMark } from '@/components/brand/Logo';
import { Skeleton } from '@/components/ui/skeleton';

/** A small ring spinner (for buttons and inline waits). */
export function Spinner({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent opacity-70', className)} />;
}

/** Whole-screen wait (first load of the app, lazy routes outside the shell). */
export function FullScreenLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas">
      <LogoMark className="h-10 w-10 animate-pulse" />
      <p className="text-[13px] text-muted-foreground">{label}</p>
    </div>
  );
}

/** Placeholder of a page inside the shell while it loads: header, toolbar and rows. */
export function PageLoader() {
  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6 px-5 py-7 sm:px-8 lg:px-10 lg:py-9" aria-busy="true">
      <div className="space-y-2.5">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-9 w-80" />
      <div className="space-y-2 rounded-xl border p-4">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
      </div>
    </div>
  );
}

/** Loading state of a detail page (case, task, client). */
export function DetailLoader() {
  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6 px-5 py-7 sm:px-8 lg:px-10 lg:py-9" aria-busy="true">
      <Skeleton className="h-4 w-24" />
      <div className="space-y-2.5">
        <Skeleton className="h-7 w-96 max-w-full" />
        <Skeleton className="h-5 w-64" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    </div>
  );
}
