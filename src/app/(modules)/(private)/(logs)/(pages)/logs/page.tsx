import { Metadata } from 'next';
import { getLogs } from '../../(actions)/actions';
import LogsTable from './components/logs-table';
import LogsFilter from './components/logs-filter';

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
  };
}) {
  const filter = searchParams ? {
    startDate: searchParams.startDate ? new Date(searchParams.startDate) : undefined,
    endDate: searchParams.endDate ? new Date(searchParams.endDate) : undefined,
    level: searchParams.level as any,
    category: searchParams.category as any,
    source: searchParams.source,
    userId: searchParams.userId,
    acknowledged: searchParams.acknowledged === 'true',
    search: searchParams.search,
  } : undefined;

  const logs = await getLogs(filter);

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">System Logs</h1>
        <p className="text-muted-foreground mt-2">
          View and manage system logs and events
        </p>
      </div>

      <div className="space-y-4">
        <LogsFilter />
        <LogsTable logs={logs} />
      </div>
    </div>
  );
}
