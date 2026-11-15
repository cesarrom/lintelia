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
import { Edit, Eye, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FormDialog } from './form-builder/FormDialog';
import type { Form } from '@repo/fintivio/schemas';
import { useNavigate } from 'react-router';

interface FormsTableProps {
  forms: Form[];
}

export default function FormsTable({ forms }: FormsTableProps) {
  const navigate = useNavigate();
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const handleView = (id: string) => {
    navigate(`/app/forms/${id}/instances`);
  };

  const handleEdit = (form: Form) => {
    setSelectedForm(form);
    setEditDialogOpen(true);
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(forms || []).map((form) => (
              <TableRow key={form.id}>
                <TableCell>{form.name}</TableCell>
                <TableCell>{form.description}</TableCell>
                <TableCell>
                  {new Date(form.createdAt!).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleView(form.id)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Instances
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(form)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Form
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <FormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        form={selectedForm}
      />
    </>
  );
} 