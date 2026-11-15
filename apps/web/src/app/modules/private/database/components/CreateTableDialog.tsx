import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ColumnDefinition, GetTablesResponse } from '@repo/fintivio/schemas';
import { PlusCircle, Trash2 } from 'lucide-react';
import { CreateTable } from './CreateTable';

interface CreateTableDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTable: (params: { tableName: string; schema: GetTablesResponse }) => Promise<{ success: boolean }>;
}

const defaultColumn: ColumnDefinition = {
  name: '',
  type: 'string',
  required: false,
  unique: false,
  primary: false,
  defaultValue: undefined,
};

const columnTypes: ColumnDefinition['type'][] = ['string', 'number', 'boolean', 'date', 'json'];

export default function CreateTableDialog({ isOpen, onClose, onCreateTable }: CreateTableDialogProps) {
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState<ColumnDefinition[]>([{ ...defaultColumn }]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddColumn = () => {
    setColumns([...columns, { ...defaultColumn }]);
  };

  const handleRemoveColumn = (index: number) => {
    setColumns(columns.filter((_, i) => i !== index));
  };

  const handleColumnChange = (index: number, field: keyof ColumnDefinition, value: any) => {
    const newColumns = [...columns];
    const columnToUpdate = { ...newColumns[index] };

    if (field === 'primary') {
      // Ensure only one primary key if value is true
      if (value === true) {
        newColumns.forEach((_, i) => { // Changed 'col' to '_' as it's not used
          if (i !== index) newColumns[i] = { ...newColumns[i], primary: false };
        });
      }
    }

    (columnToUpdate[field] as any) = value;
    newColumns[index] = columnToUpdate;
    setColumns(newColumns);
  };

  const handleSubmit = async () => {
    if (!tableName.trim()) {
      setError('Table name is required.');
      return;
    }
    if (columns.some(col => !col.name.trim())) {
      setError('All columns must have a name.');
      return;
    }
    if (columns.length === 0) {
      setError('At least one column is required.');
      return;
    }
    // Ensure at least one primary key if multiple columns exist (optional rule, can be adjusted)
    // const hasPrimaryKey = columns.some(col => col.primary);
    // if (!hasPrimaryKey && columns.length > 0) {
    //   setError('At least one column must be set as a primary key.');
    //   return;
    // }

    setIsLoading(true);
    setError(null);

    const schemaForApi: GetTablesResponse = {
      name: tableName,
      columns: columns,
      // The backend dbService.createTable only expects columns.
      // Other GetTablesResponse fields like primaryKey, foreignKeys, indexes are typically for reading schemas.
    };

    try {
      await onCreateTable({ tableName, schema: schemaForApi });
      handleCloseDialog();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Failed to create table.');
      } else {
        setError('An unknown error occurred while creating the table.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseDialog = () => {
    setTableName('');
    setColumns([{ ...defaultColumn }]);
    setError(null);
    setIsLoading(false);
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <div className="py-4 space-y-4 overflow-y-auto pr-2">
          <CreateTable
            schema={{
              name: tableName,
              columns: columns,
            }}
            onChange={schema => {
              setTableName(schema.name);
              setColumns(schema.columns);
            }}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Table'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
