import { useParams, useSearchParams } from "react-router"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import SchemaView from "./components/SchemaView";
import DataView from "./components/DataView";
import { useDatabaseExecuteQuery, useDatabaseGetTableSchema } from "@/lib/services/database.hooks";
import { useCallback } from "react";
import { GetTablesResponse } from "@repo/lintelia/schemas";

export default function TablePage() {
  const { tableName } = useParams<{ tableName: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: selectedTable, refetch: refetchTableSchema } = useDatabaseGetTableSchema({ tableName: tableName || '', enabled: !!tableName });
  const { mutateAsync: executeQuery } = useDatabaseExecuteQuery();
  const handleUpdateSchema = useCallback((updatedTable: GetTablesResponse) => {
    refetchTableSchema();
    console.log('Schema updated (mock):', updatedTable);
  }, []);

  const runQuery = async (table: string, query: string) => {
    const result = await executeQuery({ table, operation: 'read', conditions: query });
    return result;
  }


  const activeTab = searchParams.get('tab') || 'data';


  const setActiveTab = (tab: string) => {
    setSearchParams({ tab });
  };



  return <div className="h-full flex flex-col">
    {selectedTable ? (
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-grow flex flex-col min-h-0">
        <div className="px-6 pt-4 border-b">
          <TabsList>
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="schema">Schema</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="data" className="flex-grow overflow-y-auto focus-visible:ring-0 focus-visible:ring-offset-0">
          <DataView table={selectedTable} onRunQuery={runQuery} />
        </TabsContent>
        <TabsContent value="schema" className="flex-grow overflow-y-auto">
          <SchemaView table={selectedTable} onUpdateSchema={handleUpdateSchema} />
        </TabsContent>
      </Tabs>
    ) : (
      <div className="p-6 text-center text-muted-foreground h-full flex items-center justify-center">
        Select a table from the list to get started.
      </div>
    )}
  </div>
}