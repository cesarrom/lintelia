import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Plus, Trash2, UsersRound } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EffectiveDate } from '@/components/access/EffectiveDate';
import { apiErrorMessage, useApiMutation, useApiQuery } from '@/lib/services/api';
import { announceChange } from '@/lib/access';

interface Policy { requireMfa: boolean; accessApproval: 'off' | 'grants'; accessNotify: string[]; readAudit: boolean }

/**
 * Change control of access (docs/plans/15 §14): privileged changes are always told to the administrators; a second
 * administrator can be required for changes that grant access; extra addresses (the security team) can be told too.
 */
export function AccessApprovalCard() {
  const { data: policy } = useApiQuery<Policy>(['security', 'policy'], '/security/policy');
  const [extra, setExtra] = useState('');
  useEffect(() => setExtra((policy?.accessNotify ?? []).join(', ')), [policy?.accessNotify]);
  const save = useApiMutation<Partial<Policy>, unknown>(({ axios, url }, body) => axios.put(url('/security/policy'), body), [['security', 'policy'], ['access-changes'], ['auth', 'me']]);
  const run = async (body: Partial<Policy>, message: string) => {
    try {
      announceChange(await save.mutateAsync(body), message);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };
  const recipients = extra.split(',').map((e) => e.trim()).filter(Boolean);
  return (
    <Card data-testid="access-approval">
      <CardHeader>
        <CardTitle>Access changes</CardTitle>
        <CardDescription>Changes to roles, their members, identity provider groups and who may use workflows are always told to your administrators and kept in Access changes.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex items-start gap-3">
          <Switch id="access-approval" checked={policy?.accessApproval === 'grants'}
            onCheckedChange={(on) => run({ accessApproval: on ? 'grants' : 'off' }, on ? 'A second administrator is now required' : 'Second approver no longer required')} />
          <div>
            <Label htmlFor="access-approval">Require a second administrator for changes that grant access</Label>
            <p className="text-xs text-muted-foreground">Maker-checker: giving a role, adding permissions, mapping a group or widening who may use a workflow waits for another administrator. Removing access never waits. Needs at least two administrators; switching it off needs a second administrator too.</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="access-notify">Also tell (e-mail addresses, comma-separated)</Label>
          <div className="flex gap-2">
            <Input id="access-notify" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="security-team@bank.com" />
            <Button variant="outline" onClick={() => run({ accessNotify: recipients }, 'Recipients saved')} disabled={save.isPending}>Save</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Who opened which client (docs/plans/16 §7): off by default; on, every client page of the back office a member opens is
 * recorded in the audit log (client.viewed).
 */
export function ReadAuditCard() {
  const { data: policy } = useApiQuery<Policy>(['security', 'policy'], '/security/policy');
  const save = useApiMutation<Partial<Policy>, unknown>(({ axios, url }, body) => axios.put(url('/security/policy'), body), [['security', 'policy']]);
  const toggle = async (on: boolean) => {
    try {
      await save.mutateAsync({ readAudit: on });
      toast.success(on ? 'Opening a client is now recorded' : 'Opening a client is no longer recorded');
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };
  return (
    <Card data-testid="read-audit">
      <CardHeader>
        <CardTitle>Who looked at which client</CardTitle>
        <CardDescription>Changes are always in the audit log. Reading can be too: useful where regulation asks who accessed a customer&apos;s data.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        <div className="flex items-start gap-3">
          <Switch id="read-audit" checked={!!policy?.readAudit} disabled={!policy || save.isPending} onCheckedChange={(on) => void toggle(on)} />
          <div>
            <Label htmlFor="read-audit">Record every client a member opens in your back-office pages</Label>
            <p className="text-xs text-muted-foreground">Each opening of a page about a client (its tabs included) adds “client.viewed” to the audit log, with the member and the page. Off by default: it makes the log much longer.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface Mapping { group: string; role: string }
interface Preview {
  linked: boolean;
  domains: string[];
  members: Array<{ userId: string; email: string; managed: boolean; seen: boolean; groups: string[]; current: string[]; next: string[]; changed: boolean; kept: string | null }>;
  administrators: string[];
  warnings: string[];
}
interface MappingsState extends Preview { mappings: Mapping[] }
interface RoleOption { id: string; key?: string; name: string }

function PreviewTable({ preview, roles }: { preview: Preview; roles: RoleOption[] }) {
  const name = (k: string) => roles.find((r) => (r.key ?? r.id) === k)?.name ?? k;
  const shown = preview.members.filter((m) => m.managed || m.groups.length);
  return (
    <div className="space-y-2" data-testid="role-preview">
      <p className="text-sm" data-testid="role-preview-summary">
        {shown.length ? `${shown.filter((m) => m.changed).length} of ${shown.length} member(s) of your SSO domains change roles.` : 'Nobody of your SSO domains yet: people get their roles at their first sign-in through your identity provider.'}
        {' '}Administrators afterwards: <strong>{preview.administrators.join(', ') || 'none'}</strong>.
      </p>
      {preview.warnings.map((w) => <Alert key={w} variant={w.startsWith('No active administrator') ? 'destructive' : 'default'}><AlertTriangle className="h-4 w-4" /><AlertDescription>{w}</AlertDescription></Alert>)}
      {shown.length > 0 && (
        <div className="max-h-72 overflow-y-auto rounded-lg border">
          <Table>
            <TableHeader><TableRow><TableHead>Member</TableHead><TableHead>Groups</TableHead><TableHead>Roles now</TableHead><TableHead>With these mappings</TableHead></TableRow></TableHeader>
            <TableBody>
              {shown.map((m) => (
                <TableRow key={m.userId} data-changed={m.changed} className={m.changed ? 'bg-warning-soft/40' : ''}>
                  <TableCell className="text-sm">{m.email}{!m.managed && <span className="ml-1 text-xs text-muted-foreground">(local)</span>}{m.managed && !m.seen && <span className="ml-1 text-xs text-muted-foreground">(at their next sign-in)</span>}</TableCell>
                  <TableCell className="text-xs">{m.groups.join(', ') || '—'}</TableCell>
                  <TableCell className="text-xs">{m.current.map(name).join(', ') || '—'}</TableCell>
                  <TableCell className="text-xs font-medium">{m.next.map(name).join(', ') || '—'}{m.kept && <span className="ml-1 font-normal text-muted-foreground">(Administrator kept)</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/**
 * Roles from the identity provider (docs/plans/15 §5.4, §13): as soon as single sign-on is linked (a verified domain),
 * people of that domain hold the roles their groups map to — from their first sign-in through the IdP — and cannot be
 * given roles by hand. Without single sign-on, roles are managed in Fintivio. Mappings can be prepared beforehand.
 */
export function IdpRolesCard({ roles }: { roles: RoleOption[] }) {
  const { data } = useApiQuery<MappingsState>(['sso', 'role-mappings'], '/sso/role-mappings');
  const [rows, setRows] = useState<Mapping[]>([]);
  const [effectiveAt, setEffectiveAt] = useState<string | undefined>();
  const [preview, setPreview] = useState<Preview | null>(null);
  useEffect(() => { if (data) setRows(data.mappings); }, [data]);
  const previewMutation = useApiMutation<{ mappings?: Mapping[] }, Preview>(({ axios, url }, body) => axios.post(url('/sso/role-mappings/preview'), body));
  const saveMappings = useApiMutation<void, unknown>(({ axios, url }) => axios.put(url('/sso/role-mappings'), { mappings: rows.filter((r) => r.group.trim() && r.role), effectiveAt }), [['sso'], ['access-changes'], ['users'], ['roles'], ['auth', 'me']]);
  const roleKey = (r: RoleOption) => r.key ?? r.id;
  const clean = rows.filter((r) => r.group.trim() && r.role);

  const showPreview = async () => {
    try {
      setPreview(await previewMutation.mutateAsync({ mappings: clean }));
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };
  const onSave = async () => {
    try {
      announceChange(await saveMappings.mutateAsync(), 'Group mappings saved');
      setEffectiveAt(undefined);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  return (
    <Card data-testid="idp-roles">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5" />Roles from your identity provider</CardTitle>
        <CardDescription>Your identity provider decides who is in which group (joiners, movers, leavers); you decide here which role each group gives, and on the Roles page what each role may do.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <Alert data-testid="idp-roles-state" data-linked={data?.linked ? 'yes' : 'no'}>
          <AlertDescription>
            {data?.linked
              ? <>Single sign-on is linked: people of <strong>{data.domains.join(', ')}</strong> hold the roles their groups map to, from their first sign-in through your identity provider, and their roles cannot be changed by hand. Local accounts of other domains (emergency administrators, consultants) keep roles assigned here.</>
              : <>Single sign-on is not linked yet: roles are managed in Fintivio. Prepare the mappings now; as soon as a domain is verified, roles of its people come from your identity provider.</>}
          </AlertDescription>
        </Alert>

        <div className="space-y-2" data-testid="role-mappings">
          <p className="font-medium">Group → role</p>
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_14rem_auto] items-center gap-2">
              <Input aria-label="Group" placeholder="Group name as your IdP sends it, e.g. KYC-Analysts" value={row.group}
                onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, group: e.target.value } : r)))} />
              <select aria-label="Role of the group" className="h-9 rounded-md border bg-background px-2" value={row.role}
                onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, role: e.target.value } : r)))}>
                <option value="">Role…</option>
                {roles.map((r) => <option key={roleKey(r)} value={roleKey(r)}>{r.name}</option>)}
              </select>
              <Button type="button" variant="ghost" size="icon" aria-label="Remove the mapping" onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setRows([...rows, { group: '', role: '' }])}><Plus className="h-4 w-4" />Add a group</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => showPreview()}>Preview the members' roles</Button>
          </div>
          <EffectiveDate value={effectiveAt} onChange={setEffectiveAt} />
          <Button onClick={onSave} disabled={saveMappings.isPending}>Save mappings</Button>
        </div>
        {preview && <PreviewTable preview={preview} roles={roles} />}
      </CardContent>
    </Card>
  );
}
