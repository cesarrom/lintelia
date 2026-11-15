'use client';

import React, { useState, useCallback, useMemo } from 'react';

import TableList from './components/TableList';
import CreateTableDialog from './components/CreateTableDialog';
import SchemaView from './components/SchemaView';
import DataView from './components/DataView';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useDatabaseExecuteQuery, useDatabaseGetTableSchema, useDatabaseListTables, useDatabaseCreateTableSchema } from '@/lib/services/database.hooks';
import { GetTablesResponse } from '@repo/fintivio/schemas';
import { Outlet, useNavigate, useParams } from 'react-router';

export default function TablesPage() {
  const { data: t = [] } = useDatabaseListTables({});
  const { tableName = '' } = useParams<{ tableName: string }>();
  const tables = useMemo(() => t || [], [t]);
  const navigate = useNavigate();
  const { mutateAsync: createTable } = useDatabaseCreateTableSchema();
  const [isCreateTableDialogOpen, setIsCreateTableDialogOpen] = useState(false);


  return (
    <div className="h-[100dvh] flex flex-col bg-background text-foreground">
      <ResizablePanelGroup direction="horizontal" className="flex-grow min-h-0">
        <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
          <TableList
            tables={tables}
            selectedTable={tableName}
            onSelectTable={(tableName) => navigate(`/app/database/${tableName}`)}
            onOpenCreateTableDialog={() => setIsCreateTableDialogOpen(true)}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={80}>
          <Outlet />
        </ResizablePanel>
      </ResizablePanelGroup>
      <CreateTableDialog
        isOpen={isCreateTableDialogOpen}
        onClose={() => setIsCreateTableDialogOpen(false)}
        onCreateTable={createTable}
      />
    </div>
  );
}