import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EffectiveDate } from '@/components/access/EffectiveDate';
import { formatDate } from '@/components/app/page';
import { useAuth } from '@/lib/auth/AuthContext';
import { apiErrorMessage, useApiMutation, useApiQuery } from '@/lib/services/api';
import { announceChange, SOURCE_LABEL } from '@/lib/access';
import { SourceBadge } from '../roles/RolePage';

export interface RoleOption { id: string; key?: string; name: string; privileged?: boolean }
export interface AttributeDefinition { key: string; label: string; type: 'text' | 'number' | 'select' | 'list'; options: string[]; source: 'manual' | 'idp'; ssoClaim: string | null; scimAttribute: string | null }
export interface Member {
  id: string;
  email: string;
  name: string;
  roles: string[];
  assignments?: Array<{ role: string; source: string; groups: string[]; expiresAt: string | null }>;
  managedByIdp?: boolean;
  idpPending?: boolean;
  attributes?: Record<string, unknown>;
  kind: 'member' | 'client';
  status: 'active' | 'inactive';
}

const toLocal = (iso: string | null | undefined) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10) : '');

/** Several roles at once, each optionally until a date (time-bound), from now or a date (docs/plans/15 §5.6, §14). */
export function MemberRolesDialog({ member, roles, open, onOpenChange }: { member: Member; roles: RoleOption[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { permissions: mine } = useAuth();
  const [selected, setSelected] = useState<string[]>(member.roles);
  const [until, setUntil] = useState<Record<string, string>>(() => Object.fromEntries((member.assignments ?? []).filter((a) => a.expiresAt).map((a) => [a.role, toLocal(a.expiresAt)])));
  const [effectiveAt, setEffectiveAt] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const save = useApiMutation<void, unknown>(({ axios, url }) => axios.put(url(`/users/${member.id}`), {
    roleIds: selected,
    expires: Object.fromEntries(selected.map((key) => [key, until[key] ? new Date(`${until[key]}T23:59:59`).toISOString() : null])),
    effectiveAt,
  }), [['users'], ['roles'], ['access-changes'], ['auth', 'me']]);
  const key = (r: RoleOption) => r.key ?? r.id;
  const submit = async () => {
    setError(null);
    try {
      announceChange(await save.mutateAsync(), 'Roles changed');
      onOpenChange(false);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };
  void mine;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Roles of {member.email}</DialogTitle>
          <DialogDescription>A role can end on a date (holiday cover, a contractor). Giving a role may wait for a second administrator; removing one never does.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
          {roles.map((r) => (
            <div key={key(r)} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox aria-label={r.name} checked={selected.includes(key(r))} onCheckedChange={(c) => setSelected((cur) => (c === true ? [...cur, key(r)] : cur.filter((k) => k !== key(r))))} />
                {r.name}{r.privileged && <span className="text-[10px] font-medium text-[hsl(30_85%_34%)]">administers access</span>}
              </label>
              {selected.includes(key(r)) && (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  until
                  <Input type="date" aria-label={`End of ${r.name}`} className="h-8 w-36" value={until[key(r)] ?? ''} onChange={(e) => setUntil({ ...until, [key(r)]: e.target.value })} />
                </label>
              )}
            </div>
          ))}
        </div>
        <EffectiveDate value={effectiveAt} onChange={setEffectiveAt} />
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={save.isPending}>Save roles</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface Access {
  member: { id: string; email: string; name: string; status: string };
  managedByIdp: boolean;
  idpPending: boolean;
  groups: string[];
  attributes: Record<string, unknown>;
  roles: Array<{ key: string; name: string; source: string; groups: string[]; expiresAt: string | null; grantedBy: string | null }>;
  permissions: string[];
  customPermissions: string[];
  startable: Array<{ id: string; name: string }>;
  hiddenWorkflows: Array<{ id: string; name: string }>;
  queues: Array<{ workflow: string; step: string; role: string }>;
}

/** What a member can see and do (docs/plans/15 §6), and their attributes (manual ones editable). */
export function MemberAccessDialog({ memberId, open, onOpenChange }: { memberId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { hasPermission } = useAuth();
  const { data: access } = useApiQuery<Access>(['users', memberId, 'access'], `/users/${memberId}/access`);
  const { data: definitions = [] } = useApiQuery<AttributeDefinition[]>(['member-attributes'], '/member-attributes');
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    if (access) setValues(Object.fromEntries(Object.entries(access.attributes).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : String(v ?? '')])));
  }, [access]);
  const saveAttributes = useApiMutation<void>(({ axios, url }) => axios.patch(url(`/users/${memberId}/attributes`),
    Object.fromEntries(definitions.filter((d) => d.source === 'manual').map((d) => [d.key, values[d.key] ?? '']))), [['users'], ['auth', 'me']]);
  const canEdit = hasPermission('members:update');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Access of {access?.member.email ?? '…'}</DialogTitle>
          <DialogDescription>{access?.managedByIdp ? (access.idpPending ? 'Roles will come from your identity provider’s groups at their next sign-in through it.' : 'Roles come from your identity provider’s groups.') : 'Roles assigned in Lintelia.'} {access?.groups.length ? `Groups: ${access.groups.join(', ')}.` : ''}</DialogDescription>
        </DialogHeader>
        {access && (
          <div className="grid gap-5 md:grid-cols-2" data-testid="member-access">
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Roles</h3>
              {access.roles.length === 0 ? <p className="text-sm text-muted-foreground">No role.</p> : access.roles.map((r) => (
                <div key={r.key} className="flex flex-wrap items-center gap-2 text-sm">
                  <Link to={`/app/roles/${r.key}`} className="font-medium hover:underline">{r.name}</Link>
                  <SourceBadge source={r.source} groups={r.groups} />
                  {r.expiresAt && <span className="text-xs text-muted-foreground">until {formatDate(r.expiresAt)}</span>}
                  <span className="sr-only">{SOURCE_LABEL[r.source]}</span>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">{access.permissions.length} permissions{access.customPermissions.length ? `, including ${access.customPermissions.join(', ')}` : ''}.</p>
            </section>
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">May start</h3>
              <ul className="space-y-0.5 text-sm" data-testid="member-startable">{access.startable.length ? access.startable.map((w) => <li key={w.id}>{w.name}</li>) : <li className="text-muted-foreground">Nothing by hand.</li>}</ul>
            </section>
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Work queues</h3>
              <ul className="space-y-0.5 text-sm">{access.queues.length ? access.queues.map((q, i) => <li key={i}>{q.workflow} · {q.step} <span className="text-muted-foreground">({q.role})</span></li>) : <li className="text-muted-foreground">None.</li>}</ul>
            </section>
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Cases hidden from them</h3>
              <ul className="space-y-0.5 text-sm">{access.hiddenWorkflows.length ? access.hiddenWorkflows.map((w) => <li key={w.id}>{w.name}</li>) : <li className="text-muted-foreground">None (case scope applies).</li>}</ul>
            </section>
            {definitions.length > 0 && (
              <section className="space-y-2 md:col-span-2" data-testid="member-attributes">
                <h3 className="text-sm font-semibold">Attributes</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {definitions.map((d) => (
                    <div key={d.key} className="space-y-1">
                      <Label htmlFor={`attr-${d.key}`}>{d.label}{d.source === 'idp' && <span className="ml-1 text-xs font-normal text-muted-foreground">(from your identity provider)</span>}</Label>
                      {d.type === 'select' && d.source === 'manual' ? (
                        <select id={`attr-${d.key}`} className="h-9 w-full rounded-md border bg-background px-2 text-sm" disabled={!canEdit} value={values[d.key] ?? ''} onChange={(e) => setValues({ ...values, [d.key]: e.target.value })}>
                          <option value="">—</option>
                          {d.options.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <Input id={`attr-${d.key}`} value={values[d.key] ?? ''} disabled={!canEdit || d.source === 'idp'} onChange={(e) => setValues({ ...values, [d.key]: e.target.value })} />
                      )}
                    </div>
                  ))}
                </div>
                {canEdit && definitions.some((d) => d.source === 'manual') && (
                  <Button size="sm" variant="outline" onClick={async () => {
                    try { await saveAttributes.mutateAsync(); toast.success('Attributes saved'); } catch (e) { toast.error(apiErrorMessage(e)); }
                  }}>Save attributes</Button>
                )}
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The attributes the institution keeps about its members, and where they come from. */
export function AttributeDefinitionsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data = [] } = useApiQuery<AttributeDefinition[]>(['member-attributes'], '/member-attributes');
  const [rows, setRows] = useState<AttributeDefinition[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) setRows(data); }, [open, data]);
  const save = useApiMutation<void>(({ axios, url }) => axios.put(url('/member-attributes'), { attributes: rows }), [['member-attributes'], ['users'], ['auth', 'me']]);
  const update = (i: number, change: Partial<AttributeDefinition>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...change } : r)));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Member attributes</DialogTitle>
          <DialogDescription>What you keep about your team (branch, region, licences, authority limit). Conditions of workflows and screens read them as <code>member.attributes.&lt;key&gt;</code>. Values from your identity provider (an SSO claim or a directory attribute, as JSONata) are read-only here.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border p-3 md:grid-cols-[8rem_1fr_7rem_7rem_auto]" data-testid="attribute-definition">
              <Input aria-label="Key" className="font-mono text-xs" placeholder="key" value={row.key} onChange={(e) => update(i, { key: e.target.value })} />
              <Input aria-label="Label" placeholder="Label" value={row.label} onChange={(e) => update(i, { label: e.target.value })} />
              <select aria-label="Type" className="h-9 rounded-md border bg-background px-2 text-sm" value={row.type} onChange={(e) => update(i, { type: e.target.value as AttributeDefinition['type'] })}>
                {['text', 'number', 'select', 'list'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select aria-label="Source" className="h-9 rounded-md border bg-background px-2 text-sm" value={row.source} onChange={(e) => update(i, { source: e.target.value as 'manual' | 'idp' })}>
                <option value="manual">by hand</option>
                <option value="idp">from the IdP</option>
              </select>
              <Button variant="ghost" size="icon" aria-label="Remove the attribute" onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              {row.type === 'select' && (
                <Input aria-label="Options" className="col-span-2 md:col-span-5" placeholder="Options, comma-separated" value={row.options.join(', ')}
                  onChange={(e) => update(i, { options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean) })} />
              )}
              {row.source === 'idp' && (
                <>
                  <Input aria-label="SSO claim" className="col-span-2 font-mono text-xs md:col-span-2" placeholder="SSO claim, e.g. department" value={row.ssoClaim ?? ''} onChange={(e) => update(i, { ssoClaim: e.target.value || null })} />
                  <Input aria-label="Directory attribute" className="col-span-2 font-mono text-xs md:col-span-3" placeholder='Directory (SCIM), e.g. title' value={row.scimAttribute ?? ''} onChange={(e) => update(i, { scimAttribute: e.target.value || null })} />
                </>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setRows([...rows, { key: '', label: '', type: 'text', options: [], source: 'manual', ssoClaim: null, scimAttribute: null }])}><Plus className="h-4 w-4" />Add an attribute</Button>
        </div>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={async () => {
            setError(null);
            try { await save.mutateAsync(); toast.success('Attributes saved'); onOpenChange(false); } catch (e) { setError(apiErrorMessage(e)); }
          }} disabled={save.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
