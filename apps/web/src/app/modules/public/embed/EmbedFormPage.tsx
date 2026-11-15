import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'react-router';
import type { FormConfig } from '@repo/fintivio/schemas';
import { FormViewer } from '@/app/modules/private/forms/components/form-builder';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { API_BASE_URL, useAuthActions, type PublicTenant, type StoredSession } from '@/lib/auth/session';

interface PublicForm {
  name: string;
  description: string | null;
  config: FormConfig;
  tenant: PublicTenant;
}

type Step = { kind: 'form' } | { kind: 'verify'; caseId: string; reference: string; email: string } | { kind: 'done'; reference: string };

/** Origin of the page embedding us (null when opened directly). Chromium exposes ancestorOrigins; others the referrer. */
const embeddingOrigin = (): string | null => {
  if (window.parent === window) return null;
  const ancestors = (window.location as Location & { ancestorOrigins?: DOMStringList }).ancestorOrigins;
  if (ancestors?.length) return ancestors[0];
  try {
    return document.referrer ? new URL(document.referrer).origin : null;
  } catch {
    return null;
  }
};

const post = (message: Record<string, unknown>) => {
  if (window.parent !== window) window.parent.postMessage({ source: 'fintivio', ...message }, '*');
};

async function call<T>(path: string, init: RequestInit = {}, origin: string | null): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(origin ? { 'X-Embed-Origin': origin } : {}), ...(init.headers ?? {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong');
  return data as T;
}

/**
 * Hosted/embeddable form (`/embed/forms/:publicKey`): rendered inside an iframe on the institution's website (see
 * public/embed.js) or opened directly. Submitting creates a draft application and e-mails a one-time code; confirming
 * the code submits it, which starts the workflow.
 */
export default function EmbedFormPage() {
  const { publicKey } = useParams();
  const origin = useMemo(embeddingOrigin, []);
  const { adopt } = useAuthActions();
  const [form, setForm] = useState<PublicForm | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>({ kind: 'form' });
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    call<PublicForm>(`/public/forms/${publicKey}`, {}, origin).then(setForm).catch((e) => setLoadError(e.message));
  }, [publicKey, origin]);

  // Let the embedding page size the iframe to the content.
  useEffect(() => {
    if (!root.current) return;
    const observer = new ResizeObserver(() => post({ type: 'resize', height: Math.ceil(root.current!.getBoundingClientRect().height) + 32 }));
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [form, step]);

  const hasEmailField = !!form?.config.components?.some((c) => (c.config as { propertyName?: string }).propertyName === 'email' || c.type === 'email');

  const submit = async (answers: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const applicantEmail = String(answers.email ?? (form?.config.components ?? []).map((c) => answers[(c.config as { propertyName?: string }).propertyName ?? '']).find((v) => typeof v === 'string' && v.includes('@')) ?? email).trim();
      const result = await call<{ caseId: string; reference: string }>(`/public/forms/${publicKey}/submissions`, {
        method: 'POST',
        body: JSON.stringify({ email: applicantEmail, answers }),
      }, origin);
      setStep({ kind: 'verify', caseId: result.caseId, reference: result.reference, email: applicantEmail });
      post({ type: 'submitted', reference: result.reference });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (event: FormEvent) => {
    event.preventDefault();
    if (step.kind !== 'verify') return;
    setBusy(true);
    setError(null);
    try {
      const session = await call<StoredSession & { reference: string }>(`/public/forms/${publicKey}/verify`, {
        method: 'POST',
        body: JSON.stringify({ caseId: step.caseId, email: step.email, code: code.trim() }),
      }, origin);
      // Opened directly on the institution's site: the applicant is now signed in to their portal.
      if (!origin) adopt(session);
      setStep({ kind: 'done', reference: session.reference });
      post({ type: 'confirmed', reference: session.reference });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const tenant = form?.tenant;
  const portalUrl = tenant ? `${window.location.origin}/portal` : '/portal';

  return (
    <div ref={root} className="min-h-0 bg-transparent p-2">
      {loadError && <Alert variant="destructive"><AlertDescription data-testid="embed-error">{loadError}</AlertDescription></Alert>}
      {form && (
        <Card className="mx-auto max-w-2xl" style={{ borderTop: `4px solid ${tenant?.pallette.primary}` }}>
          <CardHeader>
            <p className="text-sm font-semibold" style={{ color: tenant?.pallette.primary }}>{tenant?.name}</p>
            <CardTitle data-testid="embed-form-title">{form.name}</CardTitle>
            {form.description && <CardDescription>{form.description}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <Alert variant="destructive"><AlertDescription data-testid="embed-submit-error">{error}</AlertDescription></Alert>}
            {step.kind === 'form' && (
              <>
                {!hasEmailField && (
                  <div className="space-y-2">
                    <Label htmlFor="applicant-email">Your e-mail</Label>
                    <Input id="applicant-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                )}
                <fieldset disabled={busy}>
                  <FormViewer config={form.config} onSubmit={submit} />
                </fieldset>
              </>
            )}
            {step.kind === 'verify' && (
              <form className="space-y-4" onSubmit={verify}>
                <p className="text-sm">We sent a 6-digit code to <strong>{step.email}</strong>. Enter it to confirm your application <span className="font-mono">{step.reference}</span>.</p>
                <div className="space-y-2">
                  <Label htmlFor="verification-code">Verification code</Label>
                  <Input id="verification-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
                </div>
                <Button type="submit" disabled={busy || code.trim().length < 6} style={{ background: tenant?.pallette.primary }}>Confirm</Button>
              </form>
            )}
            {step.kind === 'done' && (
              <div className="space-y-3" data-testid="embed-confirmation">
                <p className="text-lg font-semibold">Thank you — your application was received.</p>
                <p className="text-sm">Your reference is <strong className="font-mono" data-testid="application-reference">{step.reference}</strong>. We will e-mail you as it progresses.</p>
                <a className="text-sm underline" href={portalUrl} target={origin ? '_blank' : undefined} rel="noreferrer">Track your application</a>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
