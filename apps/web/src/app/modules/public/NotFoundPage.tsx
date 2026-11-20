import { Link, isRouteErrorResponse, useRouteError } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { SearchArt } from '@/components/brand/illustrations';

/** Unknown address, or an error while rendering a route: a calm page with a way back. */
export default function NotFoundPage() {
  const error = useRouteError();
  const notFound = !error || (isRouteErrorResponse(error) && error.status === 404);
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="px-6 py-5"><Link to="/" aria-label="Lintelia home"><Logo size="sm" /></Link></header>
      <main className="flex flex-1 items-center justify-center px-6 pb-20">
        <div className="max-w-md text-center">
          <SearchArt className="mx-auto w-56" />
          <p className="mt-4 font-mono text-[13px] text-primary">{notFound ? '404' : 'Something went wrong'}</p>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em]">{notFound ? 'This page does not exist' : 'This page could not be shown'}</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">
            {notFound
              ? 'The link may be old, or the page moved. Your work is safe.'
              : 'An unexpected error stopped this page. Reloading usually helps; your work is safe.'}
          </p>
          {!notFound && error instanceof Error && <p className="mt-3 rounded-lg bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">{error.message}</p>}
          <div className="mt-7 flex justify-center gap-2">
            <button type="button" onClick={() => window.history.back()} className="inline-flex h-10 items-center gap-2 rounded-lg border bg-background px-4 text-sm font-medium shadow-xs hover:bg-accent">
              <ArrowLeft className="h-4 w-4" />Go back
            </button>
            <Link to="/sign-on" className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90">Go to sign-in</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
