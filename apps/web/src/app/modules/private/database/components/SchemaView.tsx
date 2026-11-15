import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ColumnDefinition, GetTablesResponse } from '@repo/fintivio/schemas';
import { PlusCircle, Trash2, Edit3 } from 'lucide-react';
interface SchemaViewProps {
  table: GetTablesResponse | null;
  onUpdateSchema: (updatedTable: GetTablesResponse) => void; // Placeholder
}

export default function SchemaView({ table, onUpdateSchema }: SchemaViewProps) {
  // TODO: Remove console.info once onUpdateSchema is fully implemented and used for API calls.
  if (typeof onUpdateSchema === 'function') {
    console.info('onUpdateSchema prop is available for schema modifications.');
  }
  if (!table) {
    return <div className="p-6 text-center text-muted-foreground">Select a table to view its schema.</div>;
  }

  // Placeholder functions for schema modification
  const handleAddColumn = () => {
    console.log('Add column to', table.name);
    // Implement actual logic: show a dialog or inline form
  };

  const handleEditColumn = (column: ColumnDefinition) => {
    console.log('Edit column', column.name, 'in', table.name);
    // Implement actual logic
  };

  const handleDeleteColumn = (columnId: string) => {
    console.log('Delete column', columnId, 'from', table.name);
    // Implement actual logic
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-semibold">Schema: {table.name}</h3>
        <Button onClick={handleAddColumn} variant="outline">
          <PlusCircle className="mr-2 h-4 w-4" /> Add Column
        </Button>
      </div>
      
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Nullable</TableHead>
              <TableHead>Primary Key</TableHead>
              <TableHead>Default Value</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.columns.map((col) => (
              <TableRow key={col.name}>
                <TableCell className="font-medium">{col.name}</TableCell>
                <TableCell>{col.type}</TableCell>
                <TableCell>{!col.required ? 'Yes' : 'No'}</TableCell>
                <TableCell>{col.primary ? 'Yes' : 'No'}</TableCell>
                <TableCell>{col.defaultValue === undefined || col.defaultValue === null ? 'N/A' : String(col.defaultValue)}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="ghost" size="icon" onClick={() => handleEditColumn(col)} title="Edit Column">
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteColumn(col.name)} title="Delete Column">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {/* Add forms/dialogs for adding/editing columns here */}
    </div>
  );
}
