import LogsTable from './components/logs-table';
import LogsFilter from './components/logs-filter';
import LogsDashboard from './components/logs-dashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSearchParams } from 'react-router';
import { useLogsGetLogs } from '@/lib/services/logs.hooks';
import { AuditManagement } from '@descope/react-sdk';
import { useTenant } from '@/lib/providers/TenantProvider';
import { useTheme } from '@/lib/providers/ThemeProvider';


export default function LogsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { tenant } = useTenant();
  const { theme } = useTheme();
  const filter = searchParams ? {
    startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined,
    endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined,
    level: searchParams.get('level') ? searchParams.get('level') as any : undefined,
    category: searchParams.get('category') ? searchParams.get('category') as any : undefined,
    source: searchParams.get('source'),
    userId: searchParams.get('userId'),
    acknowledged: searchParams.get('acknowledged') !== undefined ? searchParams.get('acknowledged') === 'true' : undefined,
    search: searchParams.get('search'),
  } : undefined;

  const { data: logs = [] } = useLogsGetLogs((filter || {}) as any);
  const activeView = searchParams?.get('view') || 'analytics';

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">System Logs</h1>
        <p className="text-muted-foreground mt-2">
          View and manage system logs and events
        </p>
      </div>

      <Tabs defaultValue={activeView} className="space-y-4">
        <div className="flex justify-between items-center">
          <TabsList>
            {tenant ? (
              <TabsTrigger value="audit" asChild>
                <a onClick={() => setSearchParams(params => {
                  const newParams = new URLSearchParams(params);
                  newParams.set('view', 'audit');
                  return newParams;
                })}>Audit</a>
              </TabsTrigger>
            ) : null}
            <TabsTrigger value="analytics" asChild>
              <a onClick={() => setSearchParams(params => {
                const newParams = new URLSearchParams(params);
                newParams.set('view', 'analytics');
                return newParams;
              })}>Analytics Dashboard
              </a>
            </TabsTrigger>
            <TabsTrigger value="logs" asChild>
              <a onClick={() => setSearchParams(params => {
                const newParams = new URLSearchParams(params);
                newParams.set('view', 'logs');
                return newParams;
              })}>Logs Table
              </a>
            </TabsTrigger>
          </TabsList>
        </div>

        <LogsFilter />

        <TabsContent value="audit" className="space-y-4">
          <AuditManagement
            widgetId="access-key-management-widget"
            tenant={tenant.domain}
            theme={theme}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <LogsDashboard initialFilter={filter} />
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <LogsTable logs={logs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
