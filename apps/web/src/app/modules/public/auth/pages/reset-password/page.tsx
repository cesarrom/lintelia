import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { AuthShell, usePublicTenant } from '@/components/auth/AuthShell';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuthActions } from '@/lib/auth/session';

/** Choose a new password from an e-mailed reset link (`/reset-password?token=`). Existing sessions are revoked. */
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { resetPassword } = useAuthActions();
  const { domain, tenant } = usePublicTenant();
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirm) return setError('The passwords do not match');
    setBusy(true);
    setError(null);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell tenant={tenant} institution={!!domain} title="Choose a new password" description="You will be signed out everywhere else.">
      {error && <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert>}
      {done ? (
        <div className="space-y-4">
          <Alert className="border-success/25 bg-success-soft/70"><AlertDescription data-testid="reset-done">Your password was changed.</AlertDescription></Alert>
          <Button className="h-10 w-full" onClick={() => navigate('/sign-on')}>Sign in</Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="reset-password">New password (at least 10 characters)</Label>
            <Input id="reset-password" className="h-10" type="password" minLength={10} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reset-confirm">Repeat the new password</Label>
            <Input id="reset-confirm" className="h-10" type="password" minLength={10} required value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </div>
          <Button type="submit" className="h-10 w-full" disabled={busy || !token}>Change password</Button>
        </form>
      )}
    </AuthShell>
  );
}
