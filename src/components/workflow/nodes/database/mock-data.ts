import { Column } from "@/components/ui/table-editor";

export interface MockTable {
  id: string;
  name: string;
  columns: Column[];
}

export interface QueryFilter {
  column: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan';
  value: string;
}

export interface QueryConfig {
  selectedColumns: string[];
  filters: QueryFilter[];
  orderBy?: { column: string; direction: 'asc' | 'desc' };
}

const MOCK_TABLES: MockTable[] = [
  {
    id: "users",
    name: "Users",
    columns: [
      { name: "id", type: "number", isPrimary: true, isNullable: false, isUnique: true },
      { name: "email", type: "string", isPrimary: false, isNullable: false, isUnique: true },
      { name: "name", type: "string", isPrimary: false, isNullable: false, isUnique: false },
      { name: "created_at", type: "date", isPrimary: false, isNullable: false, isUnique: false },
    ],
  },
  {
    id: "orders",
    name: "Orders",
    columns: [
      { name: "id", type: "number", isPrimary: true, isNullable: false, isUnique: true },
      { name: "user_id", type: "number", isPrimary: false, isNullable: false, isUnique: false },
      { name: "total", type: "number", isPrimary: false, isNullable: false, isUnique: false },
      { name: "status", type: "string", isPrimary: false, isNullable: false, isUnique: false },
      { name: "created_at", type: "date", isPrimary: false, isNullable: false, isUnique: false },
    ],
  },
  {
    id: "products",
    name: "Products",
    columns: [
      { name: "id", type: "number", isPrimary: true, isNullable: false, isUnique: true },
      { name: "name", type: "string", isPrimary: false, isNullable: false, isUnique: false },
      { name: "price", type: "number", isPrimary: false, isNullable: false, isUnique: false },
      { name: "stock", type: "number", isPrimary: false, isNullable: false, isUnique: false },
      { name: "category", type: "string", isPrimary: false, isNullable: true, isUnique: false },
    ],
  },
];

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function fetchTables(): Promise<MockTable[]> {
  await delay(500); // Simulate network delay
  return MOCK_TABLES;
}

export async function fetchTableById(id: string): Promise<MockTable | undefined> {
  await delay(300);
  return MOCK_TABLES.find(table => table.id === id);
}

// Mock query execution
export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
}

export async function executeQuery(tableId: string, query: QueryConfig): Promise<QueryResult> {
  await delay(800);
  
  // Mock data based on table
  const mockData: Record<string, Record<string, unknown>[]> = {
    users: [
      { id: 1, email: "john@example.com", name: "John Doe", created_at: "2024-01-01" },
      { id: 2, email: "jane@example.com", name: "Jane Smith", created_at: "2024-01-02" },
    ],
    orders: [
      { id: 1, user_id: 1, total: 99.99, status: "completed", created_at: "2024-01-03" },
      { id: 2, user_id: 1, total: 149.99, status: "pending", created_at: "2024-01-04" },
      { id: 3, user_id: 2, total: 299.99, status: "completed", created_at: "2024-01-05" },
    ],
    products: [
      { id: 1, name: "Laptop", price: 999.99, stock: 50, category: "Electronics" },
      { id: 2, name: "Mouse", price: 29.99, stock: 100, category: "Electronics" },
      { id: 3, name: "Desk", price: 199.99, stock: 25, category: "Furniture" },
    ],
  };

  const table = MOCK_TABLES.find(t => t.id === tableId);
  if (!table) throw new Error("Table not found");

  const data = mockData[tableId] || [];
  let filteredData = [...data];

  // Apply filters
  if (query.filters) {
    filteredData = filteredData.filter(row => {
      return query.filters.every((filter) => {
        const value = row[filter.column];
        switch (filter.operator) {
          case "equals":
            return value === filter.value;
          case "notEquals":
            return value !== filter.value;
          case "contains":
            return String(value).includes(filter.value);
          case "greaterThan":
            return Number(value) > Number(filter.value);
          case "lessThan":
            return Number(value) < Number(filter.value);
          default:
            return true;
        }
      });
    });
  }

  // Apply sorting
  if (query.orderBy) {
    filteredData.sort((a, b) => {
      const aVal = String(a[query.orderBy!.column]);
      const bVal = String(b[query.orderBy!.column]);
      const modifier = query.orderBy!.direction === "asc" ? 1 : -1;
      return aVal.localeCompare(bVal) * modifier;
    });
  }

  // Select columns
  const selectedColumns = query.selectedColumns.length > 0 
    ? query.selectedColumns 
    : table.columns.map(c => c.name);

  const rows = filteredData.map(row => {
    const selectedRow: Record<string, unknown> = {};
    selectedColumns.forEach(column => {
      selectedRow[column] = row[column];
    });
    return selectedRow;
  });

  return {
    columns: selectedColumns,
    rows,
  };
} 