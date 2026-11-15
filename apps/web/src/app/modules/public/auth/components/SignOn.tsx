import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDomain } from '@/lib/providers/TenantProvider';
import { API_BASE_URL, afterLogin, fetchPublicTenant, isMfaChallenge, useAuthActions, type PublicTenant, type SignInResult, type StoredSession } from '@/lib/auth/session';

type Challenge =
  | { type: 'verify'; mfaToken: string; firstSeen: boolean }
  | { type: 'enroll'; enrollmentToken: string; secret: string; otpauthUri: string; firstSeen: boolean };

type Mode = 'sign-in' | 'register' | 'invitation' | 'forgot';

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

  useEffect(() => {
    if (!domain) return;
    fetchPublicTenant(domain).then((t) => {
      setTenant(t);
      setTenantMissing(!t);
    });
  }, [domain]);

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
      <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
    </div>
  );

  return (
    <div className="flex justify-center items-center min-h-screen p-4" style={tenant ? { background: tenant.pallette.secondary } : undefined}>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle style={tenant ? { color: tenant.pallette.primary } : undefined}>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
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
            <Alert className="mb-4">
              <AlertDescription data-testid="sign-on-notice">{notice}</AlertDescription>
            </Alert>
          )}

          {recovery ? (
            <div className="space-y-4" data-testid="recovery-codes">
              <p className="text-sm">Your second factor is set up. Keep these recovery codes somewhere safe: each works once if you lose your device. They are not shown again.</p>
              <ul className="grid grid-cols-2 gap-1 font-mono text-sm">{recovery.codes.map((c) => <li key={c}>{c}</li>)}</ul>
              <Button className="w-full" onClick={run(async () => { adopt(recovery.session); await finish(recovery.session, recovery.firstSeen); })}>I saved them, continue</Button>
            </div>
          ) : challenge?.type === 'verify' ? (
            <form className="space-y-4" onSubmit={run(async () => finish(await verifyMfa(domain || null, challenge.mfaToken, mfaCode.trim()), challenge.firstSeen))}>
              <p className="text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app, or one of your recovery codes.</p>
              <div className="space-y-2">
                <Label htmlFor="mfa-code">Authentication code</Label>
                <Input id="mfa-code" autoComplete="one-time-code" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} required autoFocus />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>Verify</Button>
              <Button type="button" variant="link" className="w-full" onClick={() => setChallenge(null)}>Back</Button>
            </form>
          ) : challenge?.type === 'enroll' ? (
            <form className="space-y-4" onSubmit={run(async () => {
              const { recoveryCodes, ...session } = await confirmTotp(domain || null, challenge.enrollmentToken, mfaCode.trim());
              setChallenge(null);
              setRecovery({ codes: recoveryCodes, session, firstSeen: challenge.firstSeen });
            })}>
              <p className="text-sm">A second factor is required. Add this key to your authenticator app (Google Authenticator, 1Password, Microsoft Authenticator…), then enter the code it shows.</p>
              <div className="rounded-md border bg-muted/40 p-3 space-y-1">
                <p className="font-mono text-sm break-all" data-testid="totp-secret">{challenge.secret}</p>
                <a className="text-xs text-primary underline" href={challenge.otpauthUri}>Open in an authenticator app on this device</a>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mfa-code">Authentication code</Label>
                <Input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} required autoFocus />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>Confirm</Button>
            </form>
          ) : mode === 'invitation' && invitation ? (
            <form className="space-y-4" onSubmit={run(async () => proceed(await acceptInvitation(domain || null, { token: invitation, password, name }), true))}>
              <p className="text-sm text-muted-foreground">Choose a password to activate your account.</p>
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Password (at least 10 characters)</Label>
                <Input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={10} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>Activate account</Button>
            </form>
          ) : mode === 'forgot' ? (
            <form className="space-y-4" onSubmit={run(async () => {
              await forgotPassword(domain || null, email);
              setNotice('If an account exists for this address, we sent a link to reset the password.');
            })}>
              {emailField('forgot-email')}
              <Button type="submit" className="w-full" disabled={busy}>Send reset link</Button>
              <Button type="button" variant="link" className="w-full" onClick={() => setMode('sign-in')}>Back to sign in</Button>
            </form>
          ) : (
            <Tabs value={mode} onValueChange={(value) => { setMode(value as Mode); setError(null); }}>
              {domain && (
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="sign-in">Sign in</TabsTrigger>
                  <TabsTrigger value="register">Create account</TabsTrigger>
                </TabsList>
              )}
              <TabsContent value="sign-in">
                {codeSent ? (
                  <form className="space-y-4" onSubmit={run(async () => {
                    const session = await verifyOtp(domain, email, code.trim());
                    await finish(session, !!session.firstSeen);
                  })}>
                    <div className="space-y-2">
                      <Label htmlFor="otp-code">Code</Label>
                      <Input id="otp-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} required />
                    </div>
                    <Button type="submit" className="w-full" disabled={busy}>Continue</Button>
                    <Button type="button" variant="link" className="w-full" onClick={() => { setCodeSent(false); setCode(''); setNotice(null); }}>Use a password or another e-mail</Button>
                  </form>
                ) : (
                  <form className="space-y-4" onSubmit={run(signInWithPassword)}>
                    {emailField('email')}
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                      <p className="text-xs text-muted-foreground">Your organisation uses single sign-on? Leave the password empty and continue.</p>
                    </div>
                    <Button type="submit" className="w-full" disabled={busy || tenantMissing}>Sign in</Button>
                    {domain && (
                      <Button type="button" variant="outline" className="w-full" disabled={busy || tenantMissing || !email}
                        onClick={run(async () => {
                          await startOtp(domain, email);
                          setCodeSent(true);
                          setNotice(`We sent a 6-digit code to ${email}.`);
                        })}>
                        Email me a code
                      </Button>
                    )}
                    <Button type="button" variant="link" className="w-full" onClick={() => setMode('forgot')}>Forgot password?</Button>
                  </form>
                )}
              </TabsContent>
              {domain && (
                <TabsContent value="register">
                  <form className="space-y-4" onSubmit={run(async () => finish(await register(domain, { email, password, name }), true))}>
                    <div className="space-y-2">
                      <Label htmlFor="reg-name">Full name</Label>
                      <Input id="reg-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                    </div>
                    {emailField('reg-email')}
                    <div className="space-y-2">
                      <Label htmlFor="reg-password">Password (at least 10 characters)</Label>
                      <Input id="reg-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={10} />
                    </div>
                    <Button type="submit" className="w-full" disabled={busy || tenantMissing}>Create account</Button>
                  </form>
                </TabsContent>
              )}
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
