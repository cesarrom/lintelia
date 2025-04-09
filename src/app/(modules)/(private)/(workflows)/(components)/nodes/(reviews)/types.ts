import { z } from 'zod';

// Review status
export const ReviewStatusSchema = z.enum([
  'pending',
  'in_progress',
  'approved',
  'rejected',
  'additional_data_requested'
]);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

// Review item configuration
export const ReviewItemConfigSchema = z.object({
  answer_id: z.string(),
  label: z.string().optional(), // Optional as we can get the label from the form
  required: z.boolean().default(true),
  order: z.number().default(0)
});
export type ReviewItemConfig = z.infer<typeof ReviewItemConfigSchema>;

// Review node configuration
export const ReviewNodeDataSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  items: z.array(ReviewItemConfigSchema),
  assignToRoles: z.array(z.string()).optional(),
  autoApproveOnMatch: z.boolean().optional(),
  matchCriteria: z.record(z.string(), z.any()).optional(),
  timeoutInHours: z.number().optional(),
  notifyOnAssignment: z.boolean().optional(),
  notifyOnCompletion: z.boolean().optional(),
  requireCommentOnReject: z.boolean().optional(),
  requireEvidenceOnReject: z.boolean().optional()
});
export type ReviewNodeData = z.infer<typeof ReviewNodeDataSchema>;

// Review item data
export const ReviewItemDataSchema = z.object({
  answer_id: z.string(),
  label: z.string().optional(),
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  comments: z.string().optional()
});
export type ReviewItemData = z.infer<typeof ReviewItemDataSchema>;

// Review events
export const events = {
  assigned: 'review_assigned',
  approved: 'review_approved',
  rejected: 'review_rejected',
  additionalDataRequested: 'additional_data_requested',
  timeout: 'review_timeout'
} as const;
export type ReviewEvent = (typeof events)[keyof typeof events]; 