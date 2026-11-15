import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { StatusBadge } from '@/components/app/page';
import { apiErrorMessage, useApiMutation, useApiQuery } from '@/lib/services/api';

interface Party { id: string; role: string; name: string | null; email: string; status: string; verification: string | null }

const ROLE_LABELS: Record<string, string> = { co_applicant: 'Co-applicant', guarantor: 'Guarantor', ubo: 'Beneficial owner', director: 'Director', signatory: 'Signatory' };
const label = (role: string) => ROLE_LABELS[role] ?? role.replace(/_/g, ' ');

/** The applicant lists the other people involved; each gets their own invitation (parties.collect, docs/plans/06). */
export function PartiesRequest({ caseId, roles }: { caseId: string; roles: string[] }) {
  const { data: parties = [] } = useApiQuery<Party[]>(['portal', 'parties', caseId], `/me/cases/${caseId}/parties`, { refetchInterval: 5000 });
  const [role, setRole] = useState(roles[0] ?? 'co_applicant');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const invite = useApiMutation<void>(({ axios, url }) => axios.post(url(`/me/cases/${caseId}/parties`), { role, name, email }), [['portal', 'parties', caseId]]);
  const complete = useApiMutation<void>(({ axios, url }) => axios.post(url(`/me/cases/${caseId}/parties/complete`)), [['portal']]);

  const add = async () => {
    setError(null);
    try {
      await invite.mutateAsync();
      toast.success(`${email} was invited`);
      setName(''); setEmail('');
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };
  const done = async () => {
    setError(null);
    try {
      await complete.mutateAsync();
      toast.success('Thank you: we contact everyone you listed');
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  return (
    <div className="space-y-4">
      <ul className="space-y-1 text-sm" data-testid="parties">
        {parties.map((p) => (
          <li key={p.id} className="flex items-center gap-2" data-testid="party" data-status={p.status}>
            <span className="font-medium">{p.name ?? p.email}</span><span className="text-muted-foreground">{label(p.role)} · {p.email}</span>
            <StatusBadge status={p.status === 'completed' ? 'approved' : p.status === 'declined' ? 'rejected' : 'open'} label={p.status === 'invited' ? 'Invited' : p.status === 'in_progress' ? 'Joined' : p.status} />
          </li>
        ))}
      </ul>
      <div className="grid gap-2 sm:grid-cols-4 items-end">
        <div className="space-y-1">
          <Label htmlFor={`role-${caseId}`}>Role</Label>
          <select id={`role-${caseId}`} className="w-full rounded-md border px-2 py-2 text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
            {roles.map((r) => <option key={r} value={r}>{label(r)}</option>)}
          </select>
        </div>
        <div className="space-y-1"><Label htmlFor={`party-name-${caseId}`}>Name</Label><Input id={`party-name-${caseId}`} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor={`party-email-${caseId}`}>E-mail</Label><Input id={`party-email-${caseId}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <Button variant="outline" onClick={add} disabled={!email || invite.isPending}>Invite</Button>
      </div>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <Button onClick={done} disabled={complete.isPending || parties.length === 0}>That's everyone</Button>
    </div>
  );
}
