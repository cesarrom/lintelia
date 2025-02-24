import { z } from 'zod';

export const ValidationTypeSchema = z.enum(['id_card', 'passport', 'driver_license', 'national_id']);
export type ValidationType = z.infer<typeof ValidationTypeSchema>;

export const ValidationMethodSchema = z.enum(['ocr', 'mrz', 'barcode', 'nfc']);
export type ValidationMethod = z.infer<typeof ValidationMethodSchema>;

export const IdentityValidationNodeDataSchema = z.object({
  documentType: ValidationTypeSchema,
  methods: z.array(ValidationMethodSchema),
  requiredFields: z.array(z.string()),
  allowExpired: z.boolean().optional(),
  maxExpiryDays: z.number().optional(),
  allowedCountries: z.array(z.string()).optional(),
  minAge: z.number().optional(),
  validateAddress: z.boolean().optional(),
  validateFace: z.boolean().optional(),
  validateHologram: z.boolean().optional(),
  validateUv: z.boolean().optional(),
  validateIr: z.boolean().optional()
});
export type IdentityValidationNodeData = z.infer<typeof IdentityValidationNodeDataSchema>;
export const events = {
  publicUrl: 'publicUrl',
  success: 'success'
} as const;