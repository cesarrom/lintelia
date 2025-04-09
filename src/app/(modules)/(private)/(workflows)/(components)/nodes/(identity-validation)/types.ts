import { z } from 'zod';

export const ValidationTypeSchema = z.enum(['id_card', 'passport', 'driver_license', 'national_id']);
export type ValidationType = z.infer<typeof ValidationTypeSchema>;

export const IdentityValidationNodeDataSchema = z.object({
  documentType: ValidationTypeSchema,
  selfieFile: z.string(),
  frontFile: z.string(),
  backFile: z.string().optional(),

});
export type IdentityValidationNodeData = z.infer<typeof IdentityValidationNodeDataSchema>;
export const events = {
  validationStarted: 'validation_started',
  informationError: 'information_error',
  validationCompleted: 'validation_completed'
} as const;