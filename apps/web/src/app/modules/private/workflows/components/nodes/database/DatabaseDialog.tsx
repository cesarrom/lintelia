'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DialogProps } from '../types';
import { DatabaseNodeData, TableSchema, SortConfig } from '../types';
import { CreateTable, QueryBuilder, DataForm, DeleteForm } from '../../../../database/components';
import { useDatabaseGetTableSchema, useDatabaseListTables } from '@/lib/services/database.hooks';

export function DatabaseDialog({ open, onOpenChange, data, onSave }: DialogProps) {
  const [name, setName] = useState(data.name);
  const [operation, setOperation] = useState<DatabaseNodeData['operation']>('read');
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [columns, setColumns] = useState<string[]>([]);
  const [conditions, setConditions] = useState<string>([]);
  const [sort, setSort] = useState<SortConfig[]>([]);
  const [limit, setLimit] = useState<number | undefined>();
  const [offset, setOffset] = useState<number | undefined>();
  const [insertData, setInsertData] = useState<Record<string, any>>({});
  const [updateData, setUpdateData] = useState<Record<string, any>>({});
  const [newTableSchema, setNewTableSchema] = useState<TableSchema>({
    name: '',
    columns: []
  });

  // Fetch tables
  const { data: tables = [] } = useDatabaseListTables({ enabled: true });
  const { data: tableMetadata } = useDatabaseGetTableSchema({
    enabled: !!selectedTable,
    tableName: selectedTable!
  });

  const handleSave = () => {
    let config: DatabaseNodeData;

    if (operation === 'create_table') {
      config = {
        operation: 'create_table' as const,
        schema: newTableSchema
      };
    } else {
      const baseConfig = {
        operation,
        table: selectedTable,
      };

      switch (operation) {
        case 'read':
          config = {
            ...baseConfig,
            operation: 'read' as const,
            conditions,
            sort,
            limit,
            offset
          };
          break;
        case 'insert':
          config = {
            ...baseConfig,
            operation: 'insert' as const,
            data: insertData
          };
          break;
        case 'update':
          config = {
            ...baseConfig,
            operation: 'update' as const,
            conditions,
            data: updateData
          };
          break;
        case 'delete':
          config = {
            ...baseConfig,
            operation: 'delete' as const,
            conditions
          };
          break;
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }
    }

    onSave({
      ...data,
      name,
      config
    });
    onOpenChange(false);
  };

  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Database Configuration</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Node Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter node name"
              />
            </div>

          <div className="space-y-2">
            <Label>Operation</Label>
            <Select value={operation} onValueChange={(value: DatabaseNodeData['operation']) => setOperation(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="create_table">Create Table</SelectItem>
                <SelectItem value="read">Read</SelectItem>
                <SelectItem value="insert">Insert</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {operation === 'create_table' ? (
            <CreateTable
              schema={newTableSchema}
              onChange={setNewTableSchema}
            />
          ) : (
            <>
            <div className="space-y-2">
              <Label>Select Table</Label>
                <Select
                  value={selectedTable}
                  onValueChange={setSelectedTable}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a table" />
                  </SelectTrigger>
                  <SelectContent>
                    {tables.map((table) => (
                      <SelectItem key={table} value={table}>
                        {table}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTable && tableMetadata && (
                <>
                  {operation === 'read' && (
                    <QueryBuilder
                      tableMetadata={tableMetadata}
                      columns={columns}
                      conditions={conditions}
                      sort={sort}
                      limit={limit}
                      offset={offset}
                      onColumnsChange={setColumns}
                      onConditionsChange={setConditions}
                      onSortChange={setSort}
                      onLimitChange={setLimit}
                      onOffsetChange={setOffset}
                    />
                  )}

                  {(operation === 'insert' || operation === 'update') && (
                    <DataForm
                      operation={operation}
                      tableMetadata={tableMetadata}
                      data={operation === 'insert' ? insertData : updateData}
                      onChange={operation === 'insert' ? setInsertData : setUpdateData}
                    />
                  )}

                  {operation === 'delete' && (
                    <DeleteForm
                      tableMetadata={tableMetadata}
                      conditions={conditions}
                      onConditionsChange={setConditions}
                    />
                  )}
                </>
              )}
            </>
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
  );
} 