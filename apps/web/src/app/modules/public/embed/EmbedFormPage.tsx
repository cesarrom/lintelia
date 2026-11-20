import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'react-router';
import type { FormConfig } from '@repo/lintelia/schemas';
import { FormViewer } from '@/app/modules/private/forms/components/form-builder';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, Check, CheckCircle2, Lock, MailCheck } from 'lucide-react';
import { Monogram } from '@/components/brand/Monogram';
import { brandProps } from '@/lib/brand';
import { cn } from '@/lib/utils';
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
  if (window.parent !== window) window.parent.postMessage({ source: 'lintelia', ...message }, '*');
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
  const stepIndex = step.kind === 'form' ? 0 : step.kind === 'verify' ? 1 : 2;

  return (
    <div ref={root} className="min-h-0 bg-transparent p-2" {...brandProps(tenant?.pallette.primary)}>
      {loadError && <Alert variant="destructive"><AlertDescription data-testid="embed-error">{loadError}</AlertDescription></Alert>}
      {form && (
        <Card className="mx-auto max-w-2xl overflow-hidden rounded-2xl shadow-raised">
          <div className="h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/50" />
          <CardHeader className="gap-3 space-y-0 pb-5 sm:p-7 sm:pb-5">
            <div className="flex items-center gap-2.5">
              <Monogram name={tenant?.name} color={tenant?.pallette.primary} size="sm" />
              <p className="text-[13px] font-semibold text-primary">{tenant?.name}</p>
            </div>
            <div>
              <CardTitle className="text-[22px] tracking-[-0.02em]" data-testid="embed-form-title">{form.name}</CardTitle>
              {form.description && <CardDescription className="mt-1 text-sm">{form.description}</CardDescription>}
            </div>
            <ol className="flex items-center gap-2 pt-1 text-xs font-medium" aria-label="Steps">
              {['Your details', 'Confirm your e-mail', 'Done'].map((label, i) => (
                <li key={label} className={cn('flex items-center gap-2', i > stepIndex ? 'text-muted-foreground' : 'text-foreground')}>
                  {i > 0 && <span aria-hidden="true" className={cn('h-px w-6 sm:w-10', i <= stepIndex ? 'bg-primary' : 'bg-border')} />}
                  <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[10.5px]', i < stepIndex ? 'bg-primary text-primary-foreground' : i === stepIndex ? 'bg-primary/15 text-primary ring-1 ring-primary/40' : 'bg-muted text-muted-foreground')}>
                    {i < stepIndex ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="hidden sm:inline">{label}</span>
                </li>
              ))}
            </ol>
          </CardHeader>
          <CardContent className="space-y-4 border-t pt-6 sm:p-7 sm:pt-6">
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
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3 w-3" />Sent securely to {tenant?.name ? 'the institution' : 'us'}. Nothing is submitted until you confirm your e-mail.</p>
              </>
            )}
            {step.kind === 'verify' && (
              <form className="space-y-4" onSubmit={verify}>
                <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><MailCheck className="h-4 w-4" /></span>
                  <p className="text-sm">We sent a 6-digit code to <strong>{step.email}</strong>. Enter it to confirm your application <span className="font-mono">{step.reference}</span>.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="verification-code">Verification code</Label>
                  <Input id="verification-code" className="h-12 max-w-[220px] text-center font-mono text-xl tracking-[0.45em]" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
                </div>
                <Button type="submit" className="h-10 px-6" disabled={busy || code.trim().length < 6}>Confirm</Button>
              </form>
            )}
            {step.kind === 'done' && (
              <div className="flex flex-col items-center py-4 text-center" data-testid="embed-confirmation">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success ring-8 ring-success/10"><CheckCircle2 className="h-7 w-7" /></span>
                <p className="mt-4 text-lg font-semibold">Thank you — your application was received.</p>
                <p className="mt-1 text-sm text-muted-foreground">Your reference is <strong className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-foreground" data-testid="application-reference">{step.reference}</strong>. We will e-mail you as it progresses.</p>
                <a className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90" href={portalUrl} target={origin ? '_blank' : undefined} rel="noreferrer">Track your application<ArrowRight className="h-4 w-4" /></a>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
