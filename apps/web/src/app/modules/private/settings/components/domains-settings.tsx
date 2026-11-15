import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { StatusBadge, formatDate } from '@/components/app/page';
import { apiErrorMessage, useApiMutation, useApiQuery } from '@/lib/services/api';

interface CustomDomain {
  hostname: string;
  status: 'pending_verification' | 'active' | 'failed';
  failureReason: string | null;
  lastCheckedAt: string | null;
  verification: { type: string; name: string; value: string };
  routing: { type: string; name: string; value: string };
}

/** Custom host names with DNS ownership verification (FIA-03). */
export default function DomainsSettings() {
  const { data: domains = [] } = useApiQuery<CustomDomain[]>(['domains'], '/domains');
  const [hostname, setHostname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const add = useApiMutation<void>(({ axios, url }) => axios.post(url('/domains'), { hostname }), [['domains']]);
  const verify = useApiMutation<string>(({ axios, url }, host) => axios.post(url(`/domains/${host}/verify`)), [['domains']]);
  const remove = useApiMutation<string>(({ axios, url }, host) => axios.delete(url(`/domains/${host}`)), [['domains']]);
  const run = async (action: () => Promise<unknown>, message: string) => {
    setError(null);
    try {
      await action();
      toast.success(message);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Custom domains</CardTitle>
        <CardDescription>Serve your portal and forms on your own host name (e.g. onboarding.yourbank.com) once you prove you own it.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void run(async () => { await add.mutateAsync(); setHostname(''); }, 'Domain added: create the DNS records'); }}>
          <Input aria-label="Host name" placeholder="onboarding.yourbank.com" value={hostname} onChange={(e) => setHostname(e.target.value)} />
          <Button type="submit" disabled={!hostname || add.isPending}>Add</Button>
        </form>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {domains.map((d) => (
          <div key={d.hostname} className="rounded-md border p-3 space-y-2" data-testid="custom-domain" data-status={d.status}>
            <div className="flex items-center justify-between">
              <span className="font-medium">{d.hostname}</span>
              <div className="flex items-center gap-2">
                <StatusBadge status={d.status === 'active' ? 'active' : 'open'} label={d.status === 'active' ? 'Active' : 'Waiting for DNS'} />
                {d.status !== 'active' && <Button size="sm" variant="outline" onClick={() => run(() => verify.mutateAsync(d.hostname), `${d.hostname} verified`)}>Verify now</Button>}
                <Button size="icon" variant="ghost" aria-label={`Remove ${d.hostname}`} onClick={() => run(() => remove.mutateAsync(d.hostname), `${d.hostname} removed`)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            {d.status !== 'active' && (
              <div className="text-xs space-y-1 font-mono">
                <p>{d.verification.name} TXT "{d.verification.value}"</p>
                <p>{d.routing.name} CNAME {d.routing.value}</p>
                {d.failureReason && <p className="text-red-700 font-sans">{d.failureReason} (checked {formatDate(d.lastCheckedAt)})</p>}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
