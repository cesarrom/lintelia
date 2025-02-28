'use client';

import { useState } from 'react';
import { Log } from '@/lib/entities/tenant/log.entity';
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
  Trash2,
  Eye,
  Check
} from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { acknowledgeLog, deleteLog } from '../../../(actions)/actions';
import { useAuth } from '@/lib/auth/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import ViewLogDialog from './view-log-dialog';

interface LogsTableProps {
  logs: Log[];
}

export default function LogsTable({ logs }: LogsTableProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this log?')) {
      await deleteLog(id);
      router.refresh();
    }
  };

  const handleAcknowledge = async (id: string) => {
    if (!user?.userId) return;
    await acknowledgeLog(id, user.userId);
    router.refresh();
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
        return <Badge variant="warning">{level}</Badge>;
      case 'info':
        return <Badge variant="info">{level}</Badge>;
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
                {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
              </TableCell>
              <TableCell>
                {log.acknowledged ? (
                  <Badge variant="success">
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
                    <DropdownMenuItem 
                      onClick={() => handleDelete(log.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
          {logs.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-6">
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