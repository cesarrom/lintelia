'use client';

import { Log } from '@/lib/entities/tenant/log.entity';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ViewLogDialogProps {
  log: Log | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ViewLogDialog({ 
  log, 
  open, 
  onOpenChange 
}: ViewLogDialogProps) {
  if (!log) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Log Details</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-1">Message</h3>
            <p>{log.message}</p>
          </div>

          {log.details && (
            <div>
              <h3 className="font-medium mb-1">Details</h3>
              <p className="whitespace-pre-wrap">{log.details}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium mb-1">Level</h3>
              <Badge variant={
                log.level === 'error' ? 'destructive' :
                log.level === 'warning' ? 'warning' :
                log.level === 'info' ? 'info' :
                'secondary'
              }>
                {log.level}
              </Badge>
            </div>

            <div>
              <h3 className="font-medium mb-1">Category</h3>
              <Badge variant="outline">{log.category}</Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium mb-1">Source</h3>
              <p>{log.source || '-'}</p>
            </div>

            <div>
              <h3 className="font-medium mb-1">User ID</h3>
              <p>{log.userId || '-'}</p>
            </div>
          </div>

          {log.metadata && (
            <div>
              <h3 className="font-medium mb-1">Metadata</h3>
              <ScrollArea className="h-[200px] w-full rounded-md border p-4">
                <pre className="text-sm">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              </ScrollArea>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium mb-1">Created At</h3>
              <p>{format(new Date(log.createdAt), 'PPpp')}</p>
            </div>

            {log.acknowledged && (
              <div>
                <h3 className="font-medium mb-1">Acknowledged</h3>
                <p>
                  By: {log.acknowledgedBy}<br />
                  At: {format(new Date(log.acknowledgedAt!), 'PPpp')}
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 