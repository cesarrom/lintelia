'use client';

import { useState } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  AlertCircle,
  Info,
  Bug,
  Eye,
  Check,
  User
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/auth/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import ViewLogDialog from './view-log-dialog';
import { useLogsAcknowledgeLog } from '@/lib/services/logs.hooks';
import { Log } from '@repo/lintelia/schemas';

interface LogsTableProps {
  logs: Log[];
}

export default function LogsTable({ logs }: LogsTableProps) {
  const { mutateAsync: acknowledgeLog } = useLogsAcknowledgeLog();
  const { user } = useAuth();
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  const handleAcknowledge = async (id: string) => {
    if (!user?.email) return;
    await acknowledgeLog({ id, userId: user.userId! });
    window.location.reload();

  };

  const handleView = (log: Log) => {
    setSelectedLog(log);
    setIsViewDialogOpen(true);
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-warning" />;
      case 'info':
        return <Info className="h-4 w-4 text-info" />;
      case 'debug':
        return <Bug className="h-4 w-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'error':
        return <Badge variant="destructive">{level}</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-500 hover:bg-yellow-500/90">{level}</Badge>;
      case 'info':
        return <Badge variant="secondary" className="bg-blue-500 hover:bg-blue-500/90">{level}</Badge>;
      case 'debug':
        return <Badge variant="secondary">{level}</Badge>;
      default:
        return <Badge>{level}</Badge>;
    }
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Level</TableHead>
            <TableHead>Message</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  {getLevelIcon(log.level)}
                  {getLevelBadge(log.level)}
                </div>
              </TableCell>
              <TableCell className="font-medium">{log.message}</TableCell>
              <TableCell>
                <Badge variant="outline">{log.category}</Badge>
              </TableCell>
              <TableCell>{log.source || '-'}</TableCell>
              <TableCell>
                {log.userId ? (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {log.userId}
                  </div>
                ) : '-'}
              </TableCell>
              <TableCell>
                {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
              </TableCell>
              <TableCell>
                {log.acknowledged ? (
                  <Badge variant="secondary" className="bg-green-500 hover:bg-green-500/90">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Acknowledged
                  </Badge>
                ) : (
                  <Badge variant="outline">Pending</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <span className="sr-only">Open menu</span>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleView(log)}>
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </DropdownMenuItem>
                    {!log.acknowledged && (
                      <DropdownMenuItem onClick={() => handleAcknowledge(log.id)}>
                        <Check className="mr-2 h-4 w-4" />
                        Acknowledge
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
          {logs.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-6">
                No logs found. System events will appear here when they occur.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <ViewLogDialog
        log={selectedLog}
        open={isViewDialogOpen}
        onOpenChange={setIsViewDialogOpen}
      />
    </>
  );
} 