export interface ColumnSchema {
  id: string;
  name: string;
  type: string; // e.g., 'VARCHAR(255)', 'INT', 'BOOLEAN', 'TIMESTAMP'
  isNullable: boolean;
  isPrimaryKey: boolean;
  defaultValue?: string | number | boolean | null;
  // Add other relevant properties like constraints, foreign keys, etc. if needed
}

export interface TableSchema {
  id: string;
  name: string;
  columns: ColumnSchema[];
}

export interface TableRow {
  // Using 'any' here because table cell values can be of mixed, dynamic types based on the schema.
  [columnName: string]: any; 
}

export interface QueryResult {
  columns: string[]; // Column names in the order they appear
  rows: TableRow[];
  error?: string; // To display query errors
  executionTime?: number; // in ms
}
