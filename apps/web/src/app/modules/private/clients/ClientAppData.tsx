import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, humanize } from '@/components/app/page';
import { useApiQuery } from '@/lib/services/api';
import { cn } from '@/lib/utils';

interface ProfileView {
  externalId: string | null;
  segments: string[];
  attributes: Record<string, unknown>;
  consents: Array<{ key: string; version: string; acceptedAt: string }>;
}

/** `kycLevel` → "Kyc level", `date_of_birth` → "Date of birth". */
const label = (key: string) => humanize(key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase());

const show = (value: unknown) => (value === null || value === undefined || value === '' ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value));

/**
 * What the client app knows about this client (docs/plans/11): profile attributes, segments, consents and the records
 * their app shows (accounts, cards…), as the institution's systems and the journeys wrote them.
 */
export function ClientAppData({ clientId }: { clientId: string }) {
  const { data: profile } = useApiQuery<ProfileView>(['clients', 'app-profile', clientId], `/clients/${clientId}/profile`);
  const { data: records = {} } = useApiQuery<Record<string, Array<Record<string, unknown> & { key: string; updatedAt: string }>>>(['clients', 'app-records', clientId], `/clients/${clientId}/records`);
  const collections = Object.keys(records);
  const [tab, setTab] = useState<string | null>(null);
  const current = tab && records[tab] ? tab : collections[0];
  if (!profile) return null;
  const attributes = Object.entries(profile.attributes ?? {});
  if (!attributes.length && !profile.segments.length && !collections.length && !profile.externalId) return null;
  const rows = current ? records[current] : [];
  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((k) => !['key', 'updatedAt'].includes(k)).slice(0, 7);
  return (
    <Card data-testid="client-app-data">
      <CardHeader>
        <CardTitle>In the client app</CardTitle>
        <CardDescription>Profile, segments and records the client’s app shows{profile.externalId ? ` · your id ${profile.externalId}` : ''}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-1.5" data-testid="client-segments">
          {profile.segments.map((s) => <span key={s} className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">{s}</span>)}
          {!profile.segments.length && <span className="text-sm text-muted-foreground">No segments</span>}
        </div>
        {attributes.length > 0 && (
          <dl className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {attributes.map(([key, value]) => (
              <div key={key} className="bg-card px-4 py-2.5">
                <dt className="text-xs text-muted-foreground">{label(key)}</dt>
                <dd className="mt-0.5 truncate text-sm font-medium">{show(value)}</dd>
              </div>
            ))}
          </dl>
        )}
        {profile.consents.length > 0 && (
          <p className="text-xs text-muted-foreground">Consents: {profile.consents.map((c) => `${c.key} v${c.version} (${formatDate(c.acceptedAt)})`).join(' · ')}</p>
        )}
        {collections.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5" role="tablist">
              {collections.map((c) => (
                <button key={c} type="button" role="tab" aria-selected={c === current} onClick={() => setTab(c)} data-testid="records-tab"
                  className={cn('rounded-full px-3 py-1 text-xs font-medium transition-colors', c === current ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}>
                  {label(c)} <span className="opacity-70">{records[c].length}</span>
                </button>
              ))}
            </div>
            <div className="max-h-80 overflow-auto rounded-xl border">
              <table className="w-full text-sm" data-testid="records-table">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur"><tr className="text-left text-xs text-muted-foreground"><th className="px-3 py-2 font-medium">Key</th>{columns.map((c) => <th key={c} className="px-3 py-2 font-medium">{label(c)}</th>)}</tr></thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr key={r.key}><td className="px-3 py-2 font-mono text-xs">{r.key}</td>{columns.map((c) => <td key={c} className="max-w-[220px] truncate px-3 py-2">{show(r[c])}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
