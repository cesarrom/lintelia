export interface IteratorNodeData {
  name: string;
  description?: string;
  config: {
    // The path to the array to iterate over
    arrayPath: string;
    // Optional batch size for processing items
    batchSize?: number;
    // Optional filter expression to filter items
    filterExpression?: string;
    // Optional sort expression to sort items
    sortExpression?: string;
    // Variable name for the current item in the iteration
    itemVariable: string;
    // Variable name for the current index in the iteration
    indexVariable: string;
  };
} 