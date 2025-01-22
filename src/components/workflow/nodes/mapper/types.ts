export interface FieldMapping {
  source: string;
  target: string;
  // Optional transformation expression
  transform?: string;
}

export interface MapperNodeData {
  name: string;
  description?: string;
  config: {
    // Field-to-field mappings
    mappings: FieldMapping[];
    // Optional custom mapping expression for complex transformations
    customExpression?: string;
    // Whether to include unmapped fields in the output
    includeUnmapped?: boolean;
    // Optional template for the output object
    outputTemplate?: string;
  };
} 