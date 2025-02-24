import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TableEditor, type Column } from '@/components/ui/table-editor';
import { TableSchema } from '../../types';

interface CreateTableProps {
  schema: TableSchema;
  onChange: (schema: TableSchema) => void;
}

export function CreateTable({ schema, onChange }: CreateTableProps) {
  const handleColumnChange = (columns: Column[]) => {
    onChange({
      ...schema,
      columns: columns.map(col => ({
        name: col.name,
        type: col.type === 'varchar' ? 'string' :
              col.type === 'integer' || col.type === 'bigint' || col.type === 'float' || col.type === 'double' ? 'number' :
              col.type === 'boolean' ? 'boolean' :
              col.type === 'date' || col.type === 'time' || col.type === 'timestamp' ? 'date' :
              col.type === 'json' ? 'json' : 'string',
        required: !col.isNullable,
        unique: col.isUnique,
        defaultValue: col.defaultValue
      }))
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
              columns={schema.columns.map(col => ({
                name: col.name,
                type: col.type === 'string' ? 'varchar' :
                      col.type === 'number' ? 'float' :
                      col.type === 'boolean' ? 'boolean' :
                      col.type === 'date' ? 'timestamp' :
                      col.type === 'json' ? 'json' : 'varchar',
                isPrimary: false,
                isNullable: !col.required,
                isUnique: col.unique,
                defaultValue: col.defaultValue
              }))}
              onChange={handleColumnChange}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 