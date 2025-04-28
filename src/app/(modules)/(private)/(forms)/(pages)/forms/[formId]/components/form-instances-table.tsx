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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Eye, Trash2, Copy, ExternalLink } from 'lucide-react';
import type { FormInstance } from '@/lib/entities';
import { useFormInstances } from './use-form-instances';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface FormInstancesTableProps {
  formId: string;
}

export default function FormInstancesTable({ formId }: FormInstancesTableProps) {
  const router = useRouter();
  const { instances, isLoading } = useFormInstances(formId);
  const [selectedInstance, setSelectedInstance] = useState<FormInstance | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleViewAnswers = (instance: FormInstance) => {
    router.push(`/forms/${formId}/instances/${instance.id}/answers`);
  };

  const handleGoToForm = (instance: FormInstance) => {
    const url = `/forms/${formId}/instances/${instance.id}/answers/new?promiseId=${instance.id}&key=${instance.id}`;
    window.open(url, '_blank');
  };

  const handleCopyUrl = (instance: FormInstance) => {
    const url = `${window.location.origin}/forms/${formId}/instances/${instance.id}/answers/new?promiseId=${instance.id}&key=${instance.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Form URL copied to clipboard');
  };

  const handleDelete = async (instance: FormInstance) => {
    try {
      const response = await fetch(`/api/forms/${formId}/instances/${instance.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete instance');
      }

      toast.success('Form instance deleted successfully');
      router.refresh();
    } catch (error) {
      toast.error('Failed to delete form instance');
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Created By</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {instances.map((instance) => (
            <TableRow key={instance.id}>
              <TableCell>{instance.submittedBy}</TableCell>
              <TableCell>{instance.status}</TableCell>
              <TableCell>{new Date(instance.createdAt).toLocaleString()}</TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <span className="sr-only">Open menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleViewAnswers(instance)}>
                      <Eye className="mr-2 h-4 w-4" />
                      View Answers List
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleGoToForm(instance)}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Go to Form
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleCopyUrl(instance)}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Form URL
                    </DropdownMenuItem>
                    {instance.status === 'draft' && (
                      <DropdownMenuItem onClick={() => {
                        setSelectedInstance(instance);
                        setDeleteDialogOpen(true);
                      }}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the form instance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedInstance) {
                  handleDelete(selectedInstance);
                }
                setDeleteDialogOpen(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
} 