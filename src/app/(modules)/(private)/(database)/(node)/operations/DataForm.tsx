import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { VariableInput } from '@/components/ui/variable-input';
import { TableColumn } from 'typeorm';

interface DataFormProps {
  operation: 'insert' | 'update';
  tableMetadata: {
    name: string;
    columns: TableColumn[];
  };
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
}

export function DataForm({ operation, tableMetadata, data, onChange }: DataFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{operation === 'insert' ? 'Insert Data' : 'Update Data'}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {tableMetadata.columns.map((column) => (
            <div key={column.name} className="space-y-2">
              <Label>{column.name}</Label>
              <VariableInput
                value={data[column.name]}
                onChange={(value) => onChange({ ...data, [column.name]: value })}
                placeholder={`Enter ${column.name}`}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
} 