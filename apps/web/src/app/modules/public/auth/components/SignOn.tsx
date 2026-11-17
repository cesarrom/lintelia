import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDomain } from '@/lib/providers/TenantProvider';
import { Mail, ShieldCheck, Smartphone } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { API_BASE_URL, afterLogin, fetchPublicTenant, isMfaChallenge, useAuthActions, type PublicTenant, type SignInResult, type StoredSession } from '@/lib/auth/session';

type Challenge =
  | { type: 'verify'; mfaToken: string; firstSeen: boolean }
  | { type: 'enroll'; enrollmentToken: string; secret: string; otpauthUri: string; firstSeen: boolean };

type Mode = 'sign-in' | 'register' | 'invitation' | 'forgot';

/** What the institution's client app asks at sign-up (docs/plans/11). */
interface RegistrationForm {
  available: boolean;
  enabled: boolean;
  fields: Array<{ key: string; label: string; type: string; options: string[]; required: boolean }>;
  consents: Array<{ key: string; label: string; version: string; url?: string; required: boolean }>;
}

/**
 * Sign-on page.
 *  - Tenant host (or ?tenant=): members sign in with their password; clients with a code e-mailed to them ("Email
 *    me a code", no password needed) or a password, and can create an account.
 *  - Platform host: platform staff sign in.
 *  - ?invitation=<token>: an invited member chooses a password.
 */
export function SignOn() {
  const domain = useDomain();
  const navigate = useNavigate();
  const { login, register, acceptInvitation, startOtp, verifyOtp, forgotPassword, enrollTotp, confirmTotp, verifyMfa, adopt } = useAuthActions();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [recovery, setRecovery] = useState<{ codes: string[]; session: StoredSession; firstSeen: boolean } | null>(null);
  const params = new URLSearchParams(window.location.search);
  const invitation = params.get('invitation');

  const [tenant, setTenant] = useState<PublicTenant | null>(null);
  const [tenantMissing, setTenantMissing] = useState(false);
  const [mode, setMode] = useState<Mode>(invitation ? 'invitation' : 'sign-in');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [registration, setRegistration] = useState<RegistrationForm | null>(null);
  const [profile, setProfile] = useState<Record<string, string>>({});
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!domain) return;
    fetchPublicTenant(domain).then((t) => {
      setTenant(t);
      setTenantMissing(!t);
    });
    fetch(`${API_BASE_URL}/auth/client/registration`, { headers: { 'X-Tenant': domain } })
      .then((r) => (r.ok ? r.json() : null)).then((form) => setRegistration(form?.available ? form : null)).catch(() => undefined);
  }, [domain]);

  const signUpOpen = !registration || registration.enabled;
  const consents = registration?.consents ?? [];
  const missingConsent = consents.some((c) => c.required && !accepted[c.key]);

  // Back from single sign-on: exchange the one-time hand-off code for the session (or show why it failed).
  useEffect(() => {
    const handoff = params.get('sso');
    const ssoError = params.get('sso_error');
    if (ssoError) setError(ssoError);
    if (!handoff) return;
    void (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/sso/exchange`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(domain ? { 'X-Tenant': domain } : {}) }, body: JSON.stringify({ code: handoff }) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? 'Sign-in failed');
        adopt(body);
        await finish(body, false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Sign-in failed');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** E-mail first: addresses of a domain with single sign-on go to their identity provider. */
  const signInWithPassword = async () => {
    if (email.includes('@')) {
      // On the platform host (no institution) this is the staff's company IdP.
      const response = await fetch(`${API_BASE_URL}/auth/sso/discover?email=${encodeURIComponent(email)}`, { headers: domain ? { 'X-Tenant': domain } : {} }).catch(() => null);
      const discovered = response?.ok ? await response.json() : null;
      if (discovered?.sso && discovered.redirectUrl && (discovered.enforce || !password)) {
        window.location.assign(discovered.redirectUrl);
        return;
      }
    }
    if (!password) throw new Error('Enter your password');
    await proceed(await login(domain || null, email, password), false);
  };

  const finish = async (session: StoredSession, firstSeen: boolean) => {
    const redirectPath = await afterLogin(session, domain || null, firstSeen);
    // Back to where a client was going (portal links in e-mails), never to another area or site.
    const next = params.get('next');
    navigate(next && session.user.kind === 'client' && next.startsWith('/portal') ? next : redirectPath);
  };

  /** A password was accepted: continue with the second factor when the account or the institution needs one. */
  const proceed = async (result: SignInResult, firstSeen: boolean) => {
    if (!isMfaChallenge(result)) return finish(result, firstSeen);
    setMfaCode('');
    if ('mfaRequired' in result) return setChallenge({ type: 'verify', mfaToken: result.mfaToken, firstSeen });
    const { secret, otpauthUri } = await enrollTotp(domain || null, result.enrollmentToken);
    setChallenge({ type: 'enroll', enrollmentToken: result.enrollmentToken, secret, otpauthUri, firstSeen });
  };

  const run = (action: () => Promise<void>) => async (event: FormEvent | React.MouseEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const title = domain ? (tenant?.name ?? domain) : 'Fintivio platform';
  const description = domain
    ? 'Sign in to continue'
    : 'Platform staff sign-in. Institutions use their own address (e.g. demo-bank.localhost:3001).';

  const emailField = (id: string) => (
    <div className="space-y-2">
      <Label htmlFor={id}>Email</Label>
      <Input id={id} type="email" className="h-10" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
    </div>
  );
  const divider = (
    <div className="relative py-1 text-center text-xs text-muted-foreground">
      <span className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden="true" />
      <span className="relative bg-background px-3">or</span>
    </div>
  );

  return (
    <AuthShell tenant={tenant} institution={!!domain} title={title} description={description}>
      {tenantMissing && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>Unknown institution "{domain}".</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription data-testid="sign-on-error">{error}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert className="mb-4 border-info/25 bg-info-soft/60">
          <AlertDescription data-testid="sign-on-notice">{notice}</AlertDescription>
        </Alert>
      )}

      {recovery ? (
        <div className="space-y-4" data-testid="recovery-codes">
          <div className="flex items-start gap-3 rounded-xl border border-success/25 bg-success-soft/70 p-3.5 text-sm">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <p>Your second factor is set up. Keep these recovery codes somewhere safe: each works once if you lose your device. They are not shown again.</p>
          </div>
          <ul className="grid grid-cols-2 gap-2 rounded-xl border bg-muted/30 p-3 font-mono text-[13px]">{recovery.codes.map((c) => <li key={c} className="rounded-md bg-background px-2.5 py-1.5 text-center shadow-xs">{c}</li>)}</ul>
          <Button className="h-10 w-full" onClick={run(async () => { adopt(recovery.session); await finish(recovery.session, recovery.firstSeen); })}>I saved them, continue</Button>
        </div>
      ) : challenge?.type === 'verify' ? (
        <form className="space-y-4" onSubmit={run(async () => finish(await verifyMfa(domain || null, challenge.mfaToken, mfaCode.trim()), challenge.firstSeen))}>
          <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Smartphone className="h-4 w-4" /></span>
            <p className="text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app, or one of your recovery codes.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mfa-code">Authentication code</Label>
            <Input id="mfa-code" className="h-11 text-center font-mono text-lg tracking-[0.4em]" autoComplete="one-time-code" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} required autoFocus />
          </div>
          <Button type="submit" className="h-10 w-full" disabled={busy}>Verify</Button>
          <Button type="button" variant="link" className="w-full text-muted-foreground" onClick={() => setChallenge(null)}>Back</Button>
        </form>
      ) : challenge?.type === 'enroll' ? (
        <form className="space-y-4" onSubmit={run(async () => {
          const { recoveryCodes, ...session } = await confirmTotp(domain || null, challenge.enrollmentToken, mfaCode.trim());
          setChallenge(null);
          setRecovery({ codes: recoveryCodes, session, firstSeen: challenge.firstSeen });
        })}>
          <p className="text-sm text-muted-foreground">A second factor is required. Add this key to your authenticator app (Google Authenticator, 1Password, Microsoft Authenticator…), then enter the code it shows.</p>
          <div className="space-y-2 rounded-xl border bg-muted/30 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Setup key</p>
            <p className="break-all font-mono text-[15px] font-medium tracking-wide" data-testid="totp-secret">{challenge.secret}</p>
            <a className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" href={challenge.otpauthUri}><Smartphone className="h-3 w-3" />Open in an authenticator app on this device</a>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mfa-code">Authentication code</Label>
            <Input id="mfa-code" className="h-11 text-center font-mono text-lg tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} required autoFocus />
          </div>
          <Button type="submit" className="h-10 w-full" disabled={busy}>Confirm</Button>
        </form>
      ) : mode === 'invitation' && invitation ? (
        <form className="space-y-4" onSubmit={run(async () => proceed(await acceptInvitation(domain || null, { token: invitation, password, name }), true))}>
          <p className="text-sm text-muted-foreground">Choose a password to activate your account.</p>
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" className="h-10" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Password (at least 10 characters)</Label>
            <Input id="new-password" className="h-10" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={10} />
          </div>
          <Button type="submit" className="h-10 w-full" disabled={busy}>Activate account</Button>
        </form>
      ) : mode === 'forgot' ? (
        <form className="space-y-4" onSubmit={run(async () => {
          await forgotPassword(domain || null, email);
          setNotice('If an account exists for this address, we sent a link to reset the password.');
        })}>
          {emailField('forgot-email')}
          <Button type="submit" className="h-10 w-full" disabled={busy}>Send reset link</Button>
          <Button type="button" variant="link" className="w-full text-muted-foreground" onClick={() => setMode('sign-in')}>Back to sign in</Button>
        </form>
      ) : (
        <Tabs value={mode} onValueChange={(value) => { setMode(value as Mode); setError(null); }}>
          {domain && signUpOpen && (
            <TabsList className="mb-5 grid h-10 w-full grid-cols-2">
              <TabsTrigger value="sign-in" className="h-8">Sign in</TabsTrigger>
              <TabsTrigger value="register" className="h-8">Create account</TabsTrigger>
            </TabsList>
          )}
          <TabsContent value="sign-in" className="mt-0">
            {codeSent ? (
              <form className="space-y-4" onSubmit={run(async () => {
                const session = await verifyOtp(domain, email, code.trim());
                await finish(session, !!session.firstSeen);
              })}>
                <div className="space-y-2">
                  <Label htmlFor="otp-code">Code</Label>
                  <Input id="otp-code" className="h-11 text-center font-mono text-lg tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} required />
                </div>
                <Button type="submit" className="h-10 w-full" disabled={busy}>Continue</Button>
                <Button type="button" variant="link" className="w-full text-muted-foreground" onClick={() => { setCodeSent(false); setCode(''); setNotice(null); }}>Use a password or another e-mail</Button>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={run(signInWithPassword)}>
                {emailField('email')}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setMode('forgot')}>Forgot password?</button>
                  </div>
                  <Input id="password" className="h-10" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                  <p className="text-xs text-muted-foreground">Your organisation uses single sign-on? Leave the password empty and continue.</p>
                </div>
                <Button type="submit" className="h-10 w-full" disabled={busy || tenantMissing}>Sign in</Button>
                {domain && (
                  <>
                    {divider}
                    <Button type="button" variant="outline" className="h-10 w-full" disabled={busy || tenantMissing || !email}
                      onClick={run(async () => {
                        await startOtp(domain, email);
                        setCodeSent(true);
                        setNotice(`We sent a 6-digit code to ${email}.`);
                      })}>
                      <Mail className="h-4 w-4" />Email me a code
                    </Button>
                  </>
                )}
              </form>
            )}
          </TabsContent>
          {domain && (
            <TabsContent value="register" className="mt-0">
              <form className="space-y-4" onSubmit={run(async () => finish(await register(domain, {
                email, password, name,
                ...(registration ? { profile, consents: consents.filter((c) => accepted[c.key]).map((c) => ({ key: c.key, version: c.version })) } : {}),
              }), true))}>
                <div className="space-y-2">
                  <Label htmlFor="reg-name">Full name</Label>
                  <Input id="reg-name" className="h-10" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                </div>
                {emailField('reg-email')}
                <div className="space-y-2">
                  <Label htmlFor="reg-password">Password (at least 10 characters)</Label>
                  <Input id="reg-password" className="h-10" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={10} />
                </div>
                {registration?.fields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={`reg-${field.key}`}>{field.label}{!field.required && <span className="font-normal text-muted-foreground"> (optional)</span>}</Label>
                    {field.type === 'select' ? (
                      <select id={`reg-${field.key}`} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" required={field.required} value={profile[field.key] ?? ''} onChange={(e) => setProfile((p) => ({ ...p, [field.key]: e.target.value }))}>
                        <option value="">Choose…</option>
                        {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <Input id={`reg-${field.key}`} className="h-10" required={field.required} value={profile[field.key] ?? ''} onChange={(e) => setProfile((p) => ({ ...p, [field.key]: e.target.value }))}
                        type={field.type === 'date' ? 'date' : field.type === 'phone' ? 'tel' : field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'} />
                    )}
                  </div>
                ))}
                {consents.length > 0 && (
                  <div className="space-y-2 rounded-xl border bg-muted/25 p-3" data-testid="sign-up-consents">
                    {consents.map((c) => (
                      <label key={c.key} className="flex cursor-pointer items-start gap-2.5 text-sm">
                        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]" checked={!!accepted[c.key]} onChange={(e) => setAccepted((a) => ({ ...a, [c.key]: e.target.checked }))} aria-label={`I accept the ${c.label}`} />
                        <span>I accept the {c.url ? <a href={c.url} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">{c.label}</a> : <span className="font-medium">{c.label}</span>}{!c.required && <span className="text-muted-foreground"> (optional)</span>}</span>
                      </label>
                    ))}
                  </div>
                )}
                <Button type="submit" className="h-10 w-full" disabled={busy || tenantMissing || missingConsent}>Create account</Button>
                <p className="text-center text-xs text-muted-foreground">By creating an account you can apply, upload documents and follow your applications online.</p>
              </form>
            </TabsContent>
          )}
        </Tabs>
      )}
    </AuthShell>
  );
}
