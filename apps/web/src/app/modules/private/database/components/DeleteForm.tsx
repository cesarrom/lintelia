import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VariableInput } from '@/components/ui/variable-input';
import { X } from 'lucide-react';
import { QueryCondition } from '../../../workflows/components/nodes/database/types';
import { type TableColumn } from '@/lib/services/database.service';

interface DeleteFormProps {
  tableMetadata: {
    name: string;
    columns: TableColumn[];
  };
  conditions: string;
  onConditionsChange: (conditions: string) => void;
}

export function DeleteForm({ tableMetadata, conditions, onConditionsChange }: DeleteFormProps) {
  const handleAddCondition = () => {
    if (!tableMetadata?.columns[0]) return;
    
    onConditionsChange([
      ...conditions,
      {
        field: tableMetadata.columns[0].name,
        operator: 'eq',
        value: ''
      }
    ]);
  };

  const handleUpdateCondition = (index: number, updates: Partial<QueryCondition>) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    onConditionsChange(newConditions);
  };

  const handleRemoveCondition = (index: number) => {
    onConditionsChange(conditions.filter((_, i) => i !== index));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delete Conditions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Label>Conditions</Label>
            <Button variant="outline" size="sm" onClick={handleAddCondition}>
              Add Condition
            </Button>
          </div>
          <div className="space-y-2">
            {conditions.map((condition, index) => (
              <div key={index} className="flex items-center gap-2">
                <Select
                  value={condition.field}
                  onValueChange={(value) => handleUpdateCondition(index, { field: value })}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tableMetadata.columns.map((column) => (
                      <SelectItem key={column.name} value={column.name}>
                        {column.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={condition.operator}
                  onValueChange={(value: QueryCondition['operator']) => 
                    handleUpdateCondition(index, { operator: value })
                  }
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eq">Equals</SelectItem>
                    <SelectItem value="neq">Not Equals</SelectItem>
                    <SelectItem value="gt">Greater Than</SelectItem>
                    <SelectItem value="gte">Greater Than or Equal</SelectItem>
                    <SelectItem value="lt">Less Than</SelectItem>
                    <SelectItem value="lte">Less Than or Equal</SelectItem>
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="startsWith">Starts With</SelectItem>
                    <SelectItem value="endsWith">Ends With</SelectItem>
                  </SelectContent>
                </Select>
                <VariableInput
                  value={condition.value as string}
                  onChange={(value) => handleUpdateCondition(index, { value })}
                  placeholder="Enter value"
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveCondition(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 