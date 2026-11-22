import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiErrorMessage } from '@/lib/services/api';
import { useAxios } from '@/lib/services/axios';
import { useRuntime } from './runtime';
import type { Me } from './types';

const API_BASE_URL = import.meta.env.VITE_FILES_API_BASE_URL as string;

/** Required consents (current versions) the client has not accepted yet. */
export function missingConsents(definition: ReturnType<typeof useRuntime>['definition'], me: Me | undefined) {
  if (!me) return [];
  return (definition.registration?.consents ?? []).filter((c) => c.required && !(me.consents ?? []).some((given) => given.key === c.key && given.version === c.version));
}

/**
 * Before the app: the terms the institution requires, in their current version — for clients who signed in without
 * the sign-up form (e-mailed code, the institution's systems, its identity provider) and after a new version.
 */
export function ConsentGate({ me }: { me: Me }) {
  const runtime = useRuntime();
  const { axios } = useAxios();
  const queryClient = useQueryClient();
  const missing = missingConsents(runtime.definition, me);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const updated = (me.consents ?? []).some((given) => missing.some((m) => m.key === given.key));

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      await axios.post(`${API_BASE_URL}/me/app/consents`, { consents: missing.map((c) => ({ key: c.key, version: c.version })) });
      await queryClient.invalidateQueries({ queryKey: ['client-app', 'data'] });
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto max-w-lg py-6" data-testid="consent-gate">
      <div className="rounded-2xl border bg-card p-6 shadow-raised sm:p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary"><ShieldCheck className="h-6 w-6" /></span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">{updated ? 'We updated our terms' : `Welcome to ${runtime.institution.name}`}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">Before you continue, please read and accept:</p>
        <div className="mt-5 space-y-2.5">
          {missing.map((c) => (
            <label key={c.key} className="flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]" checked={!!accepted[c.key]} onChange={(e) => setAccepted((a) => ({ ...a, [c.key]: e.target.checked }))} aria-label={`I accept the ${c.label}`} />
              <span>I accept the {c.url ? <a href={c.url} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">{c.label}</a> : <span className="font-medium">{c.label}</span>} <span className="text-muted-foreground">(version {c.version})</span></span>
            </label>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
        <Button className="mt-6 w-full" size="lg" disabled={busy || missing.some((c) => !accepted[c.key])} onClick={() => void accept()} data-testid="accept-consents">Accept and continue</Button>
        {runtime.signOut && <Button variant="ghost" className="mt-2 w-full text-muted-foreground" onClick={runtime.signOut}>Sign out</Button>}
      </div>
    </div>
  );
}
