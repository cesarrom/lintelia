import { Metadata } from 'next';
import { getLogs } from '../../(actions)/actions';
import LogsTable from './components/logs-table';
import LogsFilter from './components/logs-filter';
import LogsDashboard from './components/logs-dashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const metadata: Metadata = {
  title: 'System Logs',
  description: 'View and manage system logs and events',
};

export default async function LogsPage({
  searchParams,
}: {
  searchParams?: {
    startDate?: string;
    endDate?: string;
    level?: string;
    category?: string;
    source?: string;
    userId?: string;
    acknowledged?: string;
    search?: string;
    view?: string;
  };
}) {
  const filter = searchParams ? {
    startDate: searchParams.startDate ? new Date(searchParams.startDate) : undefined,
    endDate: searchParams.endDate ? new Date(searchParams.endDate) : undefined,
    level: searchParams.level ? searchParams.level as any : undefined,
    category: searchParams.category ? searchParams.category as any : undefined,
    source: searchParams.source,
    userId: searchParams.userId,
    acknowledged: searchParams.acknowledged !== undefined ? searchParams.acknowledged === 'true' : undefined,
    search: searchParams.search,
  } : undefined;

  const logs = await getLogs(filter);
  const activeView = searchParams?.view || 'analytics';

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
            <TabsTrigger value="analytics" asChild>
              <a href={`/logs?view=analytics${searchParams ? `&${new URLSearchParams({
                ...Object.fromEntries(
                  Object.entries(searchParams).filter(([key]) => key !== 'view')
                )
              }).toString()}` : ''}`}>
                Analytics Dashboard
              </a>
            </TabsTrigger>
            <TabsTrigger value="logs" asChild>
              <a href={`/logs?view=logs${searchParams ? `&${new URLSearchParams({
                ...Object.fromEntries(
                  Object.entries(searchParams).filter(([key]) => key !== 'view')
                )
              }).toString()}` : ''}`}>
                Logs Table
              </a>
            </TabsTrigger>
          </TabsList>
        </div>

        <LogsFilter />

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
