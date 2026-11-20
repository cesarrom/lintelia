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
import { Edit, Trash2, Plus } from 'lucide-react';
import EditSystemVariableDialog from './edit-system-variable-dialog';
import CreateSystemVariableDialog from './create-system-variable-dialog';
import { SystemVariable } from '@repo/lintelia/schemas';
import { useSystemDeleteSystemVariable } from '@/lib/services/system.hooks';

interface SystemVariablesTableProps {
  variables: SystemVariable[];
}

export default function SystemVariablesTable({ variables }: SystemVariablesTableProps) {
  const { mutateAsync: deleteSystemVariable } = useSystemDeleteSystemVariable();
  const [editingVariable, setEditingVariable] = useState<SystemVariable | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this variable?')) {
      await deleteSystemVariable({id});
      window.location.reload();
    }
  };

  const handleEdit = (variable: SystemVariable) => {
    setEditingVariable(variable);
    setIsEditDialogOpen(true);
  };

  const formatValue = (variable: SystemVariable) => {
    try {
      if (variable.type === 'json') {
        return JSON.stringify(variable.value);
      }
      if (variable.type === 'array') {
        return `[${(variable.value! as any[]).length} items]`;
      }
      return String(variable.value);
    } catch {
      return '(invalid value)';
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">System Variables</h2>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Variable
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Protected</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {variables.map((variable) => (
            <TableRow key={variable.id}>
              <TableCell className="font-medium">{variable.name}</TableCell>
              <TableCell>{variable.description}</TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {String(variable.type)}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-sm">
                {formatValue(variable)}
              </TableCell>
              <TableCell>
                <Badge variant={variable.isProtected ? 'default' : 'outline'}>
                  {variable.isProtected ? 'Yes' : 'No'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(variable)}
                  >
                    <Edit className="h-4 w-4" />
                    <span className="sr-only">Edit</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(variable.id!)}
                    disabled={variable.isProtected}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete</span>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {variables.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-6">
                No system variables found. Create your first variable to get started.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <EditSystemVariableDialog
        variable={editingVariable}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />

      <CreateSystemVariableDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </>
  );
} 