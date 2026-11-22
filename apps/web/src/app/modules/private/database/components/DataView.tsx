import React, { useCallback, useMemo, useState } from 'react';
import { QueryResult, TableRow } from '../types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow as UiTableRow } from '@/components/ui/table';
import { PlayIcon } from 'lucide-react';
import type { GetTablesResponse } from '@repo/lintelia/schemas';
import { QueryBuilderShadcn } from "react-querybuilder-shadcn";
import {
  type Field,
  InputType,
  QueryBuilder,
  type RuleGroupType,
  formatQuery,
} from "react-querybuilder";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface DataViewProps {
  table: GetTablesResponse | null;
  // In a real app, this would likely involve API calls
  onRunQuery: (tableId: string, query: string) => Promise<unknown[]>;
}

// Mock query result for initial display or if no table is selected
const initialQueryResult: QueryResult = {
  columns: [],
  rows: [],
};

const parse = {
  'jsonb': (value: unknown) => JSON.stringify(value),
  'json': (value: unknown) => JSON.stringify(value),
}

export default function DataView({ table, onRunQuery }: DataViewProps) {
  const fields = table?.columns.map(col => ({
    name: col.name,
    label: col.name,
    'inputType': ['float', 'integer', 'bigint'].includes(col.type) ? 'number' : ['timestamp', 'date', 'timestamp with time zone', 'time', 'timestamp without time zone'].includes(col.type) ? 'datetime-local' : ['boolean'].includes(col.type) ? 'checkbox' : 'text' as InputType
  }) as unknown as Field) || [];
  const [queryObject, setQueryObject] = useState<RuleGroupType>({
    combinator: "and",
    rules: [],
  });
  const query = useMemo(() => { try { return formatQuery(queryObject, { format: 'sql' }); } catch { return '' } }, [queryObject]);
  const [queryResult, setQueryResult] = useState<QueryResult>(initialQueryResult);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const typeByColumnName = useMemo(() => {
    const result: Record<string, string> = {};
    table?.columns.forEach(col => {
      result[col.name] = col.type;
    });
    return result;
  }, [table]);
  const valueToString = useCallback((value: unknown, columnName: string) => {
    const type = typeByColumnName[columnName];
    const parser = parse[type as keyof typeof parse] || ((val: unknown) => String(val));
    return parser(value);
  }, [typeByColumnName]);

  React.useEffect(() => {
    if (table) {
      // Optionally, run this default query automatically
      // handleRunQuery(`SELECT * FROM ${table.name} LIMIT 100;`);
      setQueryResult(initialQueryResult); // Reset results when table changes
    } else {
      setQueryResult(initialQueryResult);
    }
  }, [table]);

  const handleRunQuery = async (currentQuery: string) => {
    if (!table) return;
    setIsLoading(true);
    setQueryResult(initialQueryResult); // Clear previous results/errors
    const time = Date.now();
    try {
      const result = await onRunQuery(table.name, currentQuery);
      setQueryResult({
        columns: table.columns.map(c => c.name) || [],
        error: undefined,
        rows: result as TableRow[],
        executionTime: Date.now() - time,
      });
    } catch (error) {
      setQueryResult({
        columns: [],
        rows: [],
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
    setIsLoading(false);
  };

  if (!table) {
    return <div className="p-6 text-center text-muted-foreground">Select a table to view its data and run queries.</div>;
  }

  return (
    <div className="p-6 flex flex-col h-full space-y-4">
      <h3 className="text-2xl font-semibold">Data: {table.name}</h3>
      <div className="flex flex-col space-y-2 flex-grow min-h-0">
        <ResizablePanelGroup direction="vertical" className="flex-grow min-h-0">
          <ResizablePanel defaultSize={20} minSize={15} className='relative'>
            <ScrollArea className="p-2 h-full">
              <Card className='h-full'>
                <CardHeader>
                  <CardTitle>Filters</CardTitle>
                </CardHeader>
                <CardContent className='h-full'>
                  <QueryBuilderShadcn>
                    <QueryBuilder
                      fields={fields}
                      defaultQuery={queryObject}
                      onQueryChange={setQueryObject}
                    />
                  </QueryBuilderShadcn>
                </CardContent>

              </Card>
              <ScrollBar />
            </ScrollArea>
            <Button
              onClick={() => handleRunQuery(query)}
              disabled={isLoading || !query.length}
              className="absolute bottom-4 right-4"
              size="sm"
            >
              <PlayIcon className="mr-2 h-4 w-4" /> Run Query
            </Button>

            {queryResult.error && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-md text-sm">
                <p className="font-semibold">Error:</p>
                <pre className="whitespace-pre-wrap">{queryResult.error}</pre>
              </div>
            )}

          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={80}>
            <div className="border rounded-lg overflow-auto flex-grow">
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground">Loading results...</div>
              ) : queryResult.columns.length > 0 ? (
                <Table>
                  <TableHeader>
                    <UiTableRow>
                      {queryResult.columns.map((colName) => (
                        <TableHead key={colName}>{colName}</TableHead>
                      ))}
                    </UiTableRow>
                  </TableHeader>
                  <TableBody>
                    {queryResult.rows.map((row, rowIndex) => (
                      <UiTableRow key={rowIndex}>
                        {queryResult.columns.map((colName) => (
                          <TableCell key={`${rowIndex}-${colName}`}>{valueToString(row[colName], colName)}</TableCell>
                        ))}
                      </UiTableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                !queryResult.error && <div className="p-4 text-center text-muted-foreground">No results to display. Run a query.</div>
              )}
            </div>
            {queryResult.executionTime !== undefined && (
              <p className="text-xs text-muted-foreground text-right">
                Query executed in {queryResult.executionTime}ms. Displaying {queryResult.rows.length} rows.
              </p>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
