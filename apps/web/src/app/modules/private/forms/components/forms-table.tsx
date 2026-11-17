'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Edit, Eye, Globe, MoreHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth/AuthContext';
import { PublishFormDialog } from './publish-form-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FormDialog } from './form-builder/FormDialog';
import type { Form } from '@repo/fintivio/schemas';
import { useNavigate, useSearchParams } from 'react-router';

interface FormsTableProps {
  forms: Form[];
}

export default function FormsTable({ forms }: FormsTableProps) {
  const navigate = useNavigate();
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [publishing, setPublishing] = useState<Form | null>(null);
  const { hasPermission } = useAuth();

  const handleView = (id: string) => {
    navigate(`/app/forms/${id}/instances`);
  };

  const handleEdit = (form: Form) => {
    setSelectedForm(form);
    setEditDialogOpen(true);
  };

  // Opened from the experience map (`?edit=<form id>`): the form editor opens at once.
  const [search] = useSearchParams();
  const opened = useRef(false);
  useEffect(() => {
    const id = search.get('edit');
    const form = id ? forms?.find((f) => f.id === id) : undefined;
    if (form && !opened.current) {
      opened.current = true;
      handleEdit(form);
    }
  }, [forms, search]);

  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Published</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(forms || []).map((form) => (
              <TableRow key={form.id} data-testid="form-row" data-form-name={form.name}>
                <TableCell>{form.name}</TableCell>
                <TableCell>{form.description}</TableCell>
                <TableCell>{form.publicKey ? <Badge>Published</Badge> : <Badge variant="secondary">Not published</Badge>}</TableCell>
                <TableCell>
                  {new Date(form.createdAt!).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0" aria-label={`Actions for ${form.name}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleView(form.id!)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Instances
                      </DropdownMenuItem>
                      {hasPermission('forms:manage') && (
                        <DropdownMenuItem onClick={() => handleEdit(form)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Form
                        </DropdownMenuItem>
                      )}
                      {hasPermission('forms:publish') && (
                        <DropdownMenuItem onClick={() => setPublishing(form)}>
                          <Globe className="mr-2 h-4 w-4" />
                          Publish & embed
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {publishing && <PublishFormDialog form={publishing} open onOpenChange={(open) => !open && setPublishing(null)} />}

      <FormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        form={selectedForm}
      />
    </>
  );
} 