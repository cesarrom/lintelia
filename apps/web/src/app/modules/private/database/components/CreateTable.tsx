import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TableEditor } from '@/components/ui/table-editor';
import { ColumnDefinition, TableSchema } from '@repo/lintelia/schemas';

interface CreateTableProps {
  schema: TableSchema;
  onChange: (schema: TableSchema) => void;
}

export function CreateTable({ schema, onChange }: CreateTableProps) {
  const handleColumnChange = (columns: ColumnDefinition[]) => {
    onChange({
      ...schema,
      columns: columns,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Table</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Table Name</Label>
            <Input
              value={schema.name}
              onChange={(e) => onChange({ ...schema, name: e.target.value })}
              placeholder="Enter table name"
            />
          </div>
          <div className="space-y-2">
            <Label>Columns</Label>
            <TableEditor
              columns={schema.columns}
              onChange={handleColumnChange}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 