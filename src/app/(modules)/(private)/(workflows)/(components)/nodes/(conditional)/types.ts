import { z } from 'zod';

export const ComparisonValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null()
]);
export type ComparisonValue = z.infer<typeof ComparisonValueSchema>;

export const ConditionalNodeDataSchema = z.object({
  // The type of comparison to perform
  operator: z.enum([
    // Basic equality
    'equals',
    'notEquals',
    // Numeric comparisons
    'greaterThan',
    'greaterThanOrEqual',
    'lessThan',
    'lessThanOrEqual',
    // String operations
    'contains',
    'notContains', 
    'startsWith',
    'endsWith',
    'matches', // For regex matching
    // Type checks
    'isNull',
    'isNotNull',
    'isEmpty',
    'isNotEmpty',
    'isTrue',
    'isFalse'
  ]),
  // The value to compare against
  leftValue: ComparisonValueSchema.optional(),
  rightValue: ComparisonValueSchema
});

export type ConditionalNodeData = z.infer<typeof ConditionalNodeDataSchema>;

export const events = {
  true: 'true',
  false: 'false',
} as const;

export type ConditionalEvent = (typeof events)[keyof typeof events];