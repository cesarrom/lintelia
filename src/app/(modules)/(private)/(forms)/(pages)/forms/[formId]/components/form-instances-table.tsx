'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Eye, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FormInstance } from '@/lib/entities/tenant';
import ViewFormAnswersDialog from './view-form-answers-dialog';
import { useFormInstances } from './use-form-instances';

interface FormInstancesTableProps {
  formId: string;
}

export default function FormInstancesTable({ formId }: FormInstancesTableProps) {
  const { instances, isLoading } = useFormInstances(formId);
  const [selectedInstance, setSelectedInstance] = useState<FormInstance | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  const handleView = (instance: FormInstance) => {
    setSelectedInstance(instance);
    setViewDialogOpen(true);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Submitted By</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted At</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {instances.map((instance) => (
              <TableRow key={instance.id}>
                <TableCell>{instance.submittedBy}</TableCell>
                <TableCell>{instance.status}</TableCell>
                <TableCell>
                  {new Date(instance.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleView(instance)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Answers
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ViewFormAnswersDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        instance={selectedInstance}
      />
    </>
  );
} 