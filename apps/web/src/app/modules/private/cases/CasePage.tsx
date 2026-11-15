import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { KeyValues, PageContainer, StatusBadge, formatDate, humanize } from '@/components/app/page';
import { Timeline, type AuditEntry } from '@/components/app/timeline';
import { useAuth } from '@/lib/auth/AuthContext';
import { useAxios } from '@/lib/services/axios';
import { apiErrorMessage, useApiQuery } from '@/lib/services/api';
import type { CaseDetail } from './types';
import { FileList } from '@/components/app/files';

const API_BASE_URL = import.meta.env.VITE_FILES_API_BASE_URL as string;

/** A case: what was submitted, computed values, tasks and decisions, and its audit timeline. */
export default function CasePage() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { axios } = useAxios();
  const { data: kase, error, isLoading } = useApiQuery<CaseDetail>(['cases', 'detail', caseId], `/cases/${caseId}`, { refetchInterval: 4000 });
  const { data: timeline = [] } = useApiQuery<AuditEntry[]>(['cases', 'timeline', caseId], `/cases/${caseId}/timeline`, { refetchInterval: 4000 });

  if (isLoading) return <PageContainer>Loading…</PageContainer>;
  if (error || !kase) return <PageContainer><Alert variant="destructive"><AlertDescription>{apiErrorMessage(error) || 'Case not found'}</AlertDescription></Alert></PageContainer>;

  const onExport = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/cases/${kase.id}/export`);
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `case-${kase.reference}.json`;
      link.click();
      toast.success('Evidence pack exported');
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" onClick={() => navigate('/app/cases')}><ArrowLeft className="h-4 w-4 mr-2" />Back to cases</Button>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-muted-foreground" data-testid="case-reference">{kase.reference}</p>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="case-title">{kase.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span data-testid="case-status"><StatusBadge status={kase.status} /></span>
            {kase.outcome && <Badge variant="secondary" data-testid="case-outcome">{humanize(kase.outcome)}</Badge>}
            {kase.riskLevel && <span>Risk <StatusBadge status={kase.riskLevel} /></span>}
            {kase.flags.map((f) => <Badge key={f} variant="outline" data-testid="case-flag">{humanize(f)}</Badge>)}
          </div>
        </div>
        {hasPermission('cases:export') && <Button variant="outline" onClick={onExport}><Download className="h-4 w-4 mr-2" />Export evidence</Button>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <CardDescription>
                {kase.workflow.name} v{kase.workflow.version} · opened {formatDate(kase.createdAt)} via {humanize(kase.source.split(':')[0])}
                {kase.initiatedBy.email && <> by {kase.initiatedBy.email}</>}
                {kase.applicant && <> · applicant {kase.applicant.name || kase.applicant.email}</>}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <KeyValues data={kase.data} />
              {kase.calculations.map((calc) => (
                <div key={calc.step}>
                  <h3 className="mb-2 text-sm font-semibold">{calc.name}</h3>
                  <KeyValues data={calc.values} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Tasks</CardTitle></CardHeader>
            <CardContent>
              {kase.tasks.length === 0 ? <p className="text-sm text-muted-foreground">No human tasks (decided automatically).</p> : (
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Task</TableHead><TableHead>For</TableHead><TableHead>Status</TableHead><TableHead>Decision</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {kase.tasks.map((t) => (
                      <TableRow key={t.id} data-testid="case-task">
                        <TableCell>
                          {t.audience === 'member'
                            ? <button className="text-left hover:underline" onClick={() => navigate(`/app/tasks/${t.id}`)}>{t.title}</button>
                            : t.title}
                        </TableCell>
                        <TableCell className="text-sm">{t.audience === 'client' ? 'Client' : t.assignee?.email ?? humanize(t.queue?.role)}</TableCell>
                        <TableCell><StatusBadge status={t.status} /></TableCell>
                        <TableCell className="text-sm">{t.decision ? `${humanize(t.decision)} (${t.decidedBy})` : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {(kase.parties?.length ?? 0) > 0 && (
            <Card>
              <CardHeader><CardTitle>Related parties</CardTitle><CardDescription>Co-applicants, guarantors, directors and beneficial owners</CardDescription></CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm" data-testid="case-parties">
                  {kase.parties!.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-4" data-testid="case-party" data-status={p.status}>
                      <div>
                        <p className="font-medium">{p.name ?? p.email} <span className="text-muted-foreground font-normal">· {humanize(p.role)}</span></p>
                        <p className="text-xs text-muted-foreground">{p.email}{p.verification ? ` · identity ${p.verification}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={p.status === 'completed' ? 'approved' : p.status === 'declined' ? 'rejected' : 'open'} label={humanize(p.status)} />
                        {p.childCaseId && <Button size="sm" variant="outline" onClick={() => navigate(`/app/cases/${p.childCaseId}`)}>Open</Button>}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {(kase.files?.length ?? 0) > 0 && (
            <Card>
              <CardHeader><CardTitle>Files</CardTitle><CardDescription>Checked for malware and sanitised before reaching the case</CardDescription></CardHeader>
              <CardContent><FileList files={kase.files!} /></CardContent>
            </Card>
          )}

          {(kase.records?.length ?? 0) > 0 && (
            <Card>
              <CardHeader><CardTitle>Connected systems</CardTitle><CardDescription>Results written by your integrations</CardDescription></CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm" data-testid="case-records">
                  {kase.records!.map((r) => (
                    <li key={r.id} className="flex items-start justify-between gap-4" data-testid="case-record" data-type={r.type} data-status={r.status}>
                      <div>
                        <p className="font-medium">{humanize(r.type)} <span className="text-muted-foreground font-normal">· {r.connectorId}</span></p>
                        {r.summary && <p className="text-muted-foreground">{r.summary}</p>}
                        <p className="text-xs text-muted-foreground">{formatDate(r.updatedAt)}</p>
                      </div>
                      <StatusBadge status={['sent', 'approved', 'verified', 'completed', 'signed'].includes(r.status) ? 'approved' : ['failed', 'declined', 'rejected'].includes(r.status) ? 'rejected' : 'open'} label={humanize(r.status)} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Decisions</CardTitle></CardHeader>
            <CardContent>
              {kase.decisions.length === 0 ? <p className="text-sm text-muted-foreground">No decisions yet.</p> : (
                <ul className="space-y-2 text-sm" data-testid="decisions">
                  {kase.decisions.map((d, i) => (
                    <li key={i} data-testid="decision">
                      <strong>{humanize(d.decision)}</strong>{d.stage === 'first_approval' && ' (first approval)'} by {d.by} · {formatDate(d.at)}{d.reason && <> — “{d.reason}”</>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
        <Card className="h-fit">
          <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
          <CardContent><Timeline entries={timeline} /></CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
