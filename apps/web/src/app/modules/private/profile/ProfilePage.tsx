import { Building2, KeyRound, LogOut, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageContainer, humanize } from '@/components/app/page';
import { Avatar } from '@/components/brand/Monogram';

/** `cases:read`, `cases:export` → { Cases: ['read', 'export'] }; platform permissions drop their prefix. */
function groupPermissions(permissions: string[]) {
  const groups = new Map<string, string[]>();
  for (const permission of permissions) {
    const [resource, action = 'use'] = permission.replace(/^platform\./, '').split(':');
    groups.set(resource, [...(groups.get(resource) ?? []), action]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

/** The signed-in user's profile (replaces the Descope profile widget). */
export default function ProfilePage() {
  const { user, tenant, permissions, roles, logout } = useAuth();
  if (!user) return null;
  const roleNames = user.kind === 'staff' ? (user.platformRoles ?? []) : roles;

  return (
    <PageContainer className="max-w-4xl">
      <div className="relative overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="bg-aurora h-24" />
        <div className="flex flex-wrap items-end justify-between gap-4 px-6 pb-6">
          <div className="-mt-10 flex items-end gap-4">
            <Avatar name={user.name} email={user.email} size="xl" className="h-20 w-20 text-2xl ring-4 ring-card" />
            <div className="pb-1">
              <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.02em]">{user.name || user.email}</h1>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground"><Mail className="h-3.5 w-3.5" />{user.email}</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => void logout()}><LogOut className="h-4 w-4" />Sign out</Button>
        </div>
        <dl className="grid grid-cols-1 gap-px border-t bg-border/60 text-sm sm:grid-cols-3">
          <div className="bg-card px-6 py-3.5">
            <dt className="text-xs text-muted-foreground">Account type</dt>
            <dd className="mt-0.5 font-medium">{user.kind === 'staff' ? 'Platform staff' : user.kind === 'member' ? 'Institution member' : humanize(user.kind)}</dd>
          </div>
          <div className="bg-card px-6 py-3.5">
            <dt className="text-xs text-muted-foreground">Institution</dt>
            <dd className="mt-0.5 flex items-center gap-1.5 font-medium"><Building2 className="h-3.5 w-3.5 text-muted-foreground" />{tenant?.name ?? 'Lintelia platform'}</dd>
          </div>
          <div className="bg-card px-6 py-3.5">
            <dt className="text-xs text-muted-foreground">Roles</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">{roleNames.length ? roleNames.map((r) => <span key={r} className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{humanize(r)}</span>) : '—'}</dd>
          </div>
        </dl>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" />What you can do</CardTitle>
          <CardDescription>Permissions granted by your roles. The API enforces them on every request; the app only hides what you could not use.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {groupPermissions(permissions).map(([resource, actions]) => (
              <div key={resource} className="flex items-start justify-between gap-4 border-b border-dashed pb-3">
                <dt className="text-sm font-medium">{humanize(resource)}</dt>
                <dd className="flex flex-wrap justify-end gap-1">
                  {actions.map((a) => <span key={a} className="rounded-md border bg-muted/40 px-1.5 py-0.5 text-[11.5px] text-muted-foreground">{humanize(a)}</span>)}
                </dd>
              </div>
            ))}
          </dl>
          {!permissions.length && <p className="text-sm text-muted-foreground">No permissions.</p>}
        </CardContent>
      </Card>

      <p className="flex items-center gap-2 text-[13px] text-muted-foreground"><ShieldCheck className="h-4 w-4 text-success" />Your sign-ins and every change you make are recorded in the audit log.</p>
    </PageContainer>
  );
}
