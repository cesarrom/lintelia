import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VariableInput } from '@/components/ui/variable-input';
import { X } from 'lucide-react';
import { QueryCondition, SortConfig } from '../../types';
import { TableColumn } from 'typeorm';

interface QueryBuilderProps {
  tableMetadata: {
    name: string;
    columns: TableColumn[];
  };
  columns: string[];
  conditions: QueryCondition[];
  sort: SortConfig[];
  limit?: number;
  offset?: number;
  onColumnsChange: (columns: string[]) => void;
  onConditionsChange: (conditions: QueryCondition[]) => void;
  onSortChange: (sort: SortConfig[]) => void;
  onLimitChange: (limit?: number) => void;
  onOffsetChange: (offset?: number) => void;
}

export function QueryBuilder({
  tableMetadata,
  columns,
  conditions,
  sort,
  limit,
  offset,
  onColumnsChange,
  onConditionsChange,
  onSortChange,
  onLimitChange,
  onOffsetChange,
}: QueryBuilderProps) {
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

  const handleAddSort = () => {
    if (!tableMetadata?.columns[0]) return;
    
    onSortChange([
      ...sort,
      {
        field: tableMetadata.columns[0].name,
        direction: 'asc'
      }
    ]);
  };

  const handleUpdateSort = (index: number, updates: Partial<SortConfig>) => {
    const newSort = [...sort];
    newSort[index] = { ...newSort[index], ...updates };
    onSortChange(newSort);
  };

  const handleRemoveSort = (index: number) => {
    onSortChange(sort.filter((_, i) => i !== index));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Query Builder</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="columns">
          <TabsList>
            <TabsTrigger value="columns">Columns</TabsTrigger>
            <TabsTrigger value="conditions">Conditions</TabsTrigger>
            <TabsTrigger value="sort">Sort</TabsTrigger>
            <TabsTrigger value="limit">Limit & Offset</TabsTrigger>
          </TabsList>
          <TabsContent value="columns">
            <div className="space-y-2">
              <Label>Select Columns</Label>
              <div className="flex flex-wrap gap-2">
                {tableMetadata.columns.map((column) => (
                  <Button
                    key={column.name}
                    variant={columns.includes(column.name) ? "default" : "outline"}
                    onClick={() => {
                      onColumnsChange(
                        columns.includes(column.name)
                          ? columns.filter(c => c !== column.name)
                          : [...columns, column.name]
                      );
                    }}
                    size="sm"
                  >
                    {column.name}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="conditions">
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
          </TabsContent>
          <TabsContent value="sort">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>Sort</Label>
                <Button variant="outline" size="sm" onClick={handleAddSort}>
                  Add Sort
                </Button>
              </div>
              <div className="space-y-2">
                {sort.map((sortItem, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Select
                      value={sortItem.field}
                      onValueChange={(value) => handleUpdateSort(index, { field: value })}
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
                      value={sortItem.direction}
                      onValueChange={(value: 'asc' | 'desc') => 
                        handleUpdateSort(index, { direction: value })
                      }
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asc">Ascending</SelectItem>
                        <SelectItem value="desc">Descending</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveSort(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="limit">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Limit</Label>
                <Input
                  type="number"
                  value={limit}
                  onChange={(e) => onLimitChange(parseInt(e.target.value))}
                  placeholder="Enter limit"
                />
              </div>
              <div className="space-y-2">
                <Label>Offset</Label>
                <Input
                  type="number"
                  value={offset}
                  onChange={(e) => onOffsetChange(parseInt(e.target.value))}
                  placeholder="Enter offset"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
} 