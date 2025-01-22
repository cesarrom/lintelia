export interface Condition {
  field: string;
  operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'contains' | 'notContains' | 'startsWith' | 'endsWith' | 'expression';
  value: string | number | boolean;
}

export interface ConditionalNodeData {
  name: string;
  description?: string;
  condition: Condition;
  // For complex conditions using JavaScript expressions
  expression?: string;
} 