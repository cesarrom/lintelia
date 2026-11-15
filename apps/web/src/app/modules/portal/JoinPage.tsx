import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDomain } from '@/lib/providers/TenantProvider';
import { API_BASE_URL, useAuthActions } from '@/lib/auth/session';

/** A related party (co-applicant, guarantor, beneficial owner…) opens their invitation link: signed in, then their part. */
export default function JoinPage() {
  const domain = useDomain();
  const navigate = useNavigate();
  const { adopt } = useAuthActions();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // The link works once: never call it twice (effects re-run when the session changes).
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.search).get('party');
    if (!token) { setError('This link is incomplete.'); return; }
    void (async () => {
      const response = await fetch(`${API_BASE_URL}/auth/party-invitations/accept`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(domain ? { 'X-Tenant': domain } : {}) }, body: JSON.stringify({ token }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setError(body.error ?? 'This invitation is invalid or has expired.'); return; }
      adopt(body);
      navigate(`/portal/cases/${body.caseId}`, { replace: true });
    })();
  }, [domain, adopt, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>Joining the application…</CardTitle></CardHeader>
        <CardContent>{error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}</CardContent>
      </Card>
    </div>
  );
}
