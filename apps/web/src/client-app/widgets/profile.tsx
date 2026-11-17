import { useState } from 'react';
import { toast } from 'sonner';
import { Check, Download, Eraser, FileDown, KeyRound, LogOut, Mail, Pencil, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge, formatDate } from '@/components/app/page';
import { apiErrorMessage, useApiMutation, useApiQuery } from '@/lib/services/api';
import { useAxios } from '@/lib/services/axios';
import { cn } from '@/lib/utils';
import { formatAs } from '../format';
import { useRuntime } from '../runtime';
import type { Me } from '../types';
import { WidgetCard, type WidgetProps } from './shared';

const API_BASE_URL = import.meta.env.VITE_FILES_API_BASE_URL as string;

/** Personal details: name and e-mail, then the app's profile fields; editable ones can be changed in place. */
export function ProfileWidget({ props, scope }: WidgetProps) {
  const runtime = useRuntime();
  const me = scope.me as Me | undefined;
  const all = runtime.definition.profile?.fields ?? [];
  const only = Array.isArray(props.fields) && props.fields.length ? (props.fields as string[]) : null;
  const fields = only ? all.filter((f) => only.includes(f.key)) : all;
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const editable = fields.filter((f) => f.editable);
  if (!me) return null;

  const start = () => {
    setValues(Object.fromEntries(editable.map((f) => [f.key, me[f.key] === undefined || me[f.key] === null ? '' : String(me[f.key])])));
    setEditing(true);
  };
  const save = async () => {
    if (!runtime.updateProfile) return toast.info('Preview: changes are not saved');
    setSaving(true);
    try {
      await runtime.updateProfile(values);
      toast.success('Your details were updated');
      setEditing(false);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const rows: Array<{ key: string; label: string; value: unknown; type?: string }> = [
    { key: 'name', label: 'Name', value: me.name },
    { key: 'email', label: 'E-mail', value: me.email },
    ...fields.map((f) => ({ key: f.key, label: f.label, value: me[f.key], type: f.type })),
  ];
  return (
    <WidgetCard
      title={props.title || 'Personal details'} testId="profile"
      action={editable.length > 0 && !editing ? <Button size="sm" variant="outline" onClick={start} data-testid="edit-profile"><Pencil className="h-3.5 w-3.5" />Edit</Button> : undefined}
    >
      {editing ? (
        <form className="space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          {editable.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`profile-${f.key}`}>{f.label}</Label>
              {f.type === 'select' ? (
                <select id={`profile-${f.key}`} value={values[f.key] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs">
                  <option value="">—</option>
                  {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === 'textarea' ? (
                <Textarea id={`profile-${f.key}`} value={values[f.key] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
              ) : (
                <Input id={`profile-${f.key}`} className="h-10" type={f.type === 'email' ? 'email' : f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : f.type === 'phone' ? 'tel' : 'text'} value={values[f.key] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
              )}
            </div>
          ))}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}><Check className="h-4 w-4" />Save</Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}><X className="h-4 w-4" />Cancel</Button>
          </div>
        </form>
      ) : (
        <dl className="divide-y">
          {rows.map((row) => (
            <div key={row.key} className="grid gap-1 px-5 py-3 sm:grid-cols-[200px_1fr]">
              <dt className="text-sm text-muted-foreground">{row.label}</dt>
              <dd className={cn('text-sm font-medium', (row.value === undefined || row.value === null || row.value === '') && 'font-normal text-muted-foreground')} data-testid={`profile-${row.key}`}>
                {row.value === undefined || row.value === null || row.value === '' ? 'Not provided' : formatAs(row.value, row.type === 'date' ? 'date' : 'text')}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </WidgetCard>
  );
}

/** Change the password (or get a link to set one), sign out. */
export function SecurityWidget({ props, scope }: WidgetProps) {
  const runtime = useRuntime();
  const me = scope.me as Me | undefined;
  const { axios } = useAxios();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const live = runtime.mode === 'live';

  const change = async () => {
    try {
      await axios.post(`${API_BASE_URL}/auth/password/change`, { currentPassword: current, newPassword: next });
      toast.success('Your password was changed');
      setOpen(false);
      setCurrent('');
      setNext('');
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };
  const link = async () => {
    try {
      await axios.post(`${API_BASE_URL}/auth/password/forgot`, { email: me?.email });
      toast.success(`We sent a link to ${me?.email}`);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };
  return (
    <WidgetCard title={props.title || 'Sign-in and security'} testId="security">
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary"><KeyRound className="h-4 w-4" /></span>
            <div>
              <p className="text-sm font-medium">Password</p>
              <p className="text-xs text-muted-foreground">You can also sign in with a code sent to {me?.email ?? 'your e-mail'}.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={!live} onClick={() => setOpen((o) => !o)}>Change password</Button>
            <Button size="sm" variant="ghost" disabled={!live} onClick={() => void link()}><Mail className="h-3.5 w-3.5" />Send me a link</Button>
          </div>
        </div>
        {open && (
          <form className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); void change(); }}>
            <div className="space-y-1.5"><Label htmlFor="current-password">Current password</Label><Input id="current-password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></div>
            <div className="space-y-1.5"><Label htmlFor="new-password">New password (10+ characters)</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={10} value={next} onChange={(e) => setNext(e.target.value)} required /></div>
            <Button type="submit">Save</Button>
          </form>
        )}
        {runtime.signOut && (
          <div className="flex items-center justify-between gap-3 border-t pt-4">
            <p className="text-sm text-muted-foreground">Signed in as <span className="font-medium text-foreground">{me?.email}</span></p>
            <Button size="sm" variant="outline" onClick={runtime.signOut} data-testid="sign-out"><LogOut className="h-3.5 w-3.5" />Sign out</Button>
          </div>
        )}
      </div>
    </WidgetCard>
  );
}

interface MyDataRequest {
  id: string;
  type: 'export' | 'erasure';
  status: 'open' | 'completed' | 'rejected';
  resolution: string | null;
  requestedAt: string;
  completedAt: string | null;
  hasExport: boolean;
}

/** Consents given, a copy of my data, erasure. */
export function PrivacyWidget({ props, scope }: WidgetProps) {
  const runtime = useRuntime();
  const me = scope.me as Me | undefined;
  const live = runtime.mode === 'live';
  const { axios } = useAxios();
  const { data: requests = [] } = useApiQuery<MyDataRequest[]>(['portal', 'data-requests'], live ? '/me/data-requests' : null, { refetchInterval: 10000 });
  const file = useApiMutation<'export' | 'erasure'>(({ axios, url }, type) => axios.post(url('/me/data-requests'), { type }), [['portal', 'data-requests']]);
  const consents = runtime.definition.registration?.consents ?? [];

  const request = async (type: 'export' | 'erasure') => {
    if (type === 'erasure' && !window.confirm('Erase your personal data? You will lose access to the app.')) return;
    try {
      await file.mutateAsync(type);
      toast.success(type === 'export' ? 'We received your request for a copy of your data' : 'We received your erasure request');
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };
  const download = async (id: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/me/data-requests/${id}/export`);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' }));
      a.download = 'my-data.json';
      a.click();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };
  return (
    <WidgetCard title={props.title || 'Your data'} testId="privacy">
      <div className="space-y-5 p-5">
        {consents.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">What you agreed to</p>
            <ul className="space-y-1.5">
              {consents.map((c) => {
                const given = me?.consents?.find((g) => g.key === c.key);
                return (
                  <li key={c.key} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
                    <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />{c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{c.label}</a> : c.label}<span className="text-xs text-muted-foreground">v{c.version}</span></span>
                    <span className="text-xs text-muted-foreground">{given ? `accepted ${formatDate(given.acceptedAt)}` : 'not accepted'}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border bg-muted/20 p-4">
            <FileDown className="h-5 w-5 text-primary" />
            <p className="mt-2 text-sm font-medium">A copy of your data</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Everything we hold about you, as a file.</p>
            <Button size="sm" className="mt-3" disabled={!live || file.isPending} onClick={() => void request('export')}>Request a copy</Button>
          </div>
          <div className="rounded-xl border bg-muted/20 p-4">
            <Eraser className="h-5 w-5 text-destructive" />
            <p className="mt-2 text-sm font-medium">Erasure</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Unless the law requires us to keep records.</p>
            <Button size="sm" variant="outline" className="mt-3" disabled={!live || file.isPending} onClick={() => void request('erasure')}>Erase my data</Button>
          </div>
        </div>
        {requests.length > 0 && (
          <ul className="space-y-2">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm" data-testid="data-request" data-type={r.type}>
                <span>{r.type === 'export' ? 'Copy of my data' : 'Erasure'} · {formatDate(r.requestedAt)}{r.resolution ? ` · ${r.resolution}` : ''}</span>
                <span className="flex items-center gap-2">
                  <StatusBadge status={r.status} label={r.status === 'open' ? 'In progress' : r.status === 'completed' ? 'Done' : 'Declined'} />
                  {r.hasExport && <Button size="sm" variant="outline" onClick={() => void download(r.id)}><Download className="h-3.5 w-3.5" />Download</Button>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </WidgetCard>
  );
}
