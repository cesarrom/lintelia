
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

interface TableListProps {
  tables: string[];
  selectedTable: string | null;
  onSelectTable: (table: string) => void;
  onOpenCreateTableDialog: () => void;
}

export default function TableList({ tables, selectedTable, onSelectTable, onOpenCreateTableDialog }: TableListProps) {
  return (
    <div className="p-4 border-r h-full overflow-y-auto bg-muted/40">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Tables</h2>
        <Button variant="ghost" size="icon" onClick={onOpenCreateTableDialog} title="Create New Table">
          <PlusCircle className="h-5 w-5" />
        </Button>
      </div>
      <ul className="space-y-1">
        {tables.map((table) => (
          <li key={table}>
            <button
              onClick={() => onSelectTable(table)}
              className={cn(
                'w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent hover:text-accent-foreground',
                selectedTable === table && 'bg-accent text-accent-foreground font-medium'
              )}
            >
              {table}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
