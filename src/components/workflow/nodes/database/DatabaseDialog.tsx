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
import { Plus, X } from 'lucide-react';
import { TableEditor, type Column } from '@/components/ui/table-editor';
import { useTables, useTable } from './use-database';
import { type QueryConfig } from './mock-data';
import { VariableInput } from '@/components/ui/variable-input';
import { DialogProps } from '../types';
import { useNodes } from 'reactflow';

interface DatabaseConfig {
  selectedTable?: string;
  query?: QueryConfig;
}

export function DatabaseDialog({ open, onOpenChange, data, onSave }: DialogProps) {
  const nodes = useNodes();
  const [name, setName] = useState(data.name);
  const [dbConfig, setDbConfig] = useState<DatabaseConfig>(() => {
    if (data.config?.database) {
      return data.config.database as DatabaseConfig;
    }
    return {
      query: {
        selectedColumns: [],
        filters: [],
      },
    };
  });

  // State for the table creation dialog
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [newTable, setNewTable] = useState<{ name: string; columns: Column[] }>({
    name: '',
    columns: [],
  });

  // Fetch tables
  const { data: tables = [], isLoading: isLoadingTables } = useTables();
  const { data: selectedTable } = useTable(dbConfig.selectedTable);

  const handleSave = () => {
    onSave({
      ...data,
      name,
      config: {
        ...data.config,
        database: dbConfig,
      },
    });
    onOpenChange(false);
  };

  const handleCreateTable = () => {
    if (newTable.name && newTable.columns.length > 0) {
      // In a real app, we would make an API call here
      // For now, we'll just close the dialog
      setTableDialogOpen(false);
      setNewTable({
        name: '',
        columns: [],
      });
    }
  };

  const handleColumnToggle = (columnName: string) => {
    const query = dbConfig.query || { selectedColumns: [], filters: [] };
    const selectedColumns = query.selectedColumns.includes(columnName)
      ? query.selectedColumns.filter(col => col !== columnName)
      : [...query.selectedColumns, columnName];
    
    setDbConfig({
      ...dbConfig,
      query: {
        ...query,
        selectedColumns,
      },
    });
  };

  const handleAddFilter = () => {
    if (!selectedTable || !selectedTable.columns[0]) return;
    
    const query = dbConfig.query || { selectedColumns: [], filters: [] };
    setDbConfig({
      ...dbConfig,
      query: {
        ...query,
        filters: [
          ...query.filters,
          {
            column: selectedTable.columns[0].name,
            operator: 'equals',
            value: '',
          },
        ],
      },
    });
  };

  const handleUpdateFilter = (index: number, updates: Partial<QueryConfig['filters'][0]>) => {
    const query = dbConfig.query || { selectedColumns: [], filters: [] };
    const filters = [...query.filters];
    filters[index] = { ...filters[index], ...updates };
    
    setDbConfig({
      ...dbConfig,
      query: {
        ...query,
        filters,
      },
    });
  };

  const handleRemoveFilter = (index: number) => {
    const query = dbConfig.query || { selectedColumns: [], filters: [] };
    setDbConfig({
      ...dbConfig,
      query: {
        ...query,
        filters: query.filters.filter((_, i) => i !== index),
      },
    });
  };

  return (
    <>
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
              <Label>Select Table</Label>
              <div className="flex gap-2">
                <Select
                  value={dbConfig.selectedTable}
                  onValueChange={(value) => setDbConfig({ 
                    ...dbConfig, 
                    selectedTable: value,
                    query: {
                      selectedColumns: [],
                      filters: [],
                    },
                  })}
                  disabled={isLoadingTables}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={isLoadingTables ? "Loading..." : "Select a table"} />
                  </SelectTrigger>
                  <SelectContent>
                    {tables.map((table) => (
                      <SelectItem key={table.id} value={table.id}>
                        {table.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setTableDialogOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {selectedTable && (
              <div className="space-y-4 border rounded-lg p-4">
                <div className="space-y-2">
                  <Label>Select Columns</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedTable.columns.map((column) => (
                      <Button
                        key={column.name}
                        variant={dbConfig.query?.selectedColumns.includes(column.name) ? "default" : "outline"}
                        onClick={() => handleColumnToggle(column.name)}
                        size="sm"
                      >
                        {column.name}
                      </Button>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Filters</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddFilter}
                    >
                      Add Filter
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {dbConfig.query?.filters.map((filter, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Select
                          value={filter.column}
                          onValueChange={(value) => handleUpdateFilter(index, { column: value })}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedTable.columns.map((column) => (
                              <SelectItem key={column.name} value={column.name}>
                                {column.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={filter.operator}
                          onValueChange={(value: QueryConfig['filters'][0]['operator']) => 
                            handleUpdateFilter(index, { operator: value })
                          }
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="equals">Equals</SelectItem>
                            <SelectItem value="notEquals">Not Equals</SelectItem>
                            <SelectItem value="contains">Contains</SelectItem>
                            <SelectItem value="greaterThan">Greater Than</SelectItem>
                            <SelectItem value="lessThan">Less Than</SelectItem>
                          </SelectContent>
                        </Select>
                        <VariableInput
                          value={filter.value}
                          onChange={(value) => handleUpdateFilter(index, { value })}
                          nodes={nodes}
                          placeholder="Enter value"
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveFilter(index)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Order By</Label>
                  <div className="flex gap-2">
                    <Select
                      value={dbConfig.query?.orderBy?.column}
                      onValueChange={(value) => setDbConfig({
                        ...dbConfig,
                        query: {
                          ...(dbConfig.query || { selectedColumns: [], filters: [] }),
                          orderBy: {
                            column: value,
                            direction: dbConfig.query?.orderBy?.direction || 'asc',
                          },
                        },
                      })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedTable.columns.map((column) => (
                          <SelectItem key={column.name} value={column.name}>
                            {column.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {dbConfig.query?.orderBy?.column && (
                      <Select
                        value={dbConfig.query.orderBy.direction}
                        onValueChange={(value: 'asc' | 'desc') => {
                          const query = dbConfig.query || { selectedColumns: [], filters: [] };
                          setDbConfig({
                            ...dbConfig,
                            query: {
                              ...query,
                              orderBy: {
                                ...query.orderBy!,
                                direction: value,
                              },
                            },
                          });
                        }}
                      >
                        <SelectTrigger className="w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="asc">Ascending</SelectItem>
                          <SelectItem value="desc">Descending</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={tableDialogOpen} onOpenChange={setTableDialogOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Create New Table</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Table Name</Label>
              <Input
                value={newTable.name}
                onChange={(e) => setNewTable({ ...newTable, name: e.target.value })}
                placeholder="Enter table name"
              />
            </div>
            <div className="space-y-2">
              <Label>Columns</Label>
              <TableEditor
                columns={newTable.columns}
                onChange={(columns) => setNewTable({ ...newTable, columns })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTableDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTable}>Create Table</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 