import { useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiErrorMessage, useApiMutation, useApiQuery } from '@/lib/services/api';

interface SecurityPolicy { requireMfa: boolean; updatedAt: string | null; updatedBy: string | null }
interface SsoStatus {
  configured: boolean;
  organizationId: string | null;
  connections: Array<{ id: string; type: string; state: string; name: string }>;
  domains: Array<{ domain: string; state: string }>;
  enforce: boolean;
  jit: { enabled: boolean; defaultRoles: string[] };
  ready: boolean;
}
interface RoleOption { id: string; key?: string; name: string }

/**
 * Sign-in security of the institution (security:manage): second factor for password sign-ins (FIA-08) and single
 * sign-on through the SSO broker's Admin Portal, with enforcement per verified domain and just-in-time accounts (FIA-06).
 */
export default function SecuritySettings() {
  const { data: policy } = useApiQuery<SecurityPolicy>(['security', 'policy'], '/security/policy');
  const { data: sso, refetch } = useApiQuery<SsoStatus>(['sso'], '/sso');
  const { data: roles = [] } = useApiQuery<RoleOption[]>(['roles', 'getRoles'], '/roles');
  const [error, setError] = useState<string | null>(null);
  const savePolicy = useApiMutation<boolean>(({ axios, url }, requireMfa) => axios.put(url('/security/policy'), { requireMfa }), [['security', 'policy']]);
  const link = useApiMutation<'sso' | 'domain_verification' | 'dsync', { link: string }>(({ axios, url }, intent) => axios.post(url('/sso/setup-link'), { intent }), [['sso']]);
  const saveSso = useApiMutation<Partial<{ enforce: boolean; jit: { enabled: boolean; defaultRoles: string[] } }>>(({ axios, url }, body) => axios.put(url('/sso/settings'), body), [['sso']]);

  const run = async (action: () => Promise<unknown>, message?: string) => {
    setError(null);
    try {
      await action();
      if (message) toast.success(message);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const openPortal = (intent: 'sso' | 'domain_verification' | 'dsync') => run(async () => {
    const { link: url } = await link.mutateAsync(intent);
    window.open(url, '_blank', 'noopener');
  });

  const roleKey = (r: RoleOption) => r.key ?? r.id;

  return (
    <div className="space-y-6">
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Second factor</CardTitle>
          <CardDescription>Members who sign in with a password also confirm with an authenticator app. Single sign-on users rely on your identity provider's MFA.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Switch id="require-mfa" checked={policy?.requireMfa ?? true} onCheckedChange={(value) => run(() => savePolicy.mutateAsync(value), value ? 'Second factor required' : 'Second factor optional')} />
          <Label htmlFor="require-mfa">Require a second factor for password sign-ins</Label>
        </CardContent>
      </Card>

      <Card data-testid="sso-settings">
        <CardHeader>
          <CardTitle>Single sign-on</CardTitle>
          <CardDescription>Your IT team connects your identity provider (Entra ID, Okta, Google…) and verifies your e-mail domains in a secure setup portal. Fintivio never sees their secrets.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => openPortal('sso')}><ExternalLink className="h-4 w-4 mr-2" />Configure the identity provider</Button>
            <Button variant="outline" onClick={() => openPortal('domain_verification')}><ExternalLink className="h-4 w-4 mr-2" />Verify domains</Button>
            <Button variant="outline" onClick={() => openPortal('dsync')}><ExternalLink className="h-4 w-4 mr-2" />Directory sync (SCIM)</Button>
            <Button variant="ghost" onClick={() => refetch()}>Refresh status</Button>
          </div>
          {sso?.configured && (
            <>
              <div>
                <p className="font-medium mb-1">Connections</p>
                {sso.connections.length === 0 ? <p className="text-muted-foreground">None yet.</p> : sso.connections.map((c) => <p key={c.id}>{c.name} <Badge variant="secondary">{c.state}</Badge></p>)}
              </div>
              <div>
                <p className="font-medium mb-1">Domains</p>
                {sso.domains.length === 0 ? <p className="text-muted-foreground">None yet.</p> : sso.domains.map((d) => <p key={d.domain} data-testid="sso-domain" data-state={d.state}>{d.domain} <Badge variant="secondary">{d.state}</Badge></p>)}
              </div>
              <div className="flex items-center gap-3">
                <Switch id="enforce-sso" checked={sso.enforce} disabled={!sso.ready && !sso.enforce} onCheckedChange={(enforce) => run(() => saveSso.mutateAsync({ enforce }), enforce ? 'Single sign-on enforced' : 'Passwords allowed again')} />
                <Label htmlFor="enforce-sso">Require single sign-on for verified domains (passwords refused)</Label>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Switch id="jit" checked={sso.jit.enabled} onCheckedChange={(enabled) => run(() => saveSso.mutateAsync({ jit: { enabled, defaultRoles: sso.jit.defaultRoles } }))} />
                  <Label htmlFor="jit">Create accounts on first sign-in (just in time)</Label>
                </div>
                {sso.jit.enabled && (
                  <div className="flex flex-wrap gap-3 pl-12">
                    {roles.map((r) => (
                      <label key={roleKey(r)} className="flex items-center gap-1">
                        <input type="checkbox" checked={sso.jit.defaultRoles.includes(roleKey(r))} onChange={(e) => run(() => saveSso.mutateAsync({ jit: { enabled: true, defaultRoles: e.target.checked ? [...sso.jit.defaultRoles, roleKey(r)] : sso.jit.defaultRoles.filter((k) => k !== roleKey(r)) } }))} />
                        {r.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
