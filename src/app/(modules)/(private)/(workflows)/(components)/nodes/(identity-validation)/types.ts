import { z } from 'zod';

export const ValidationTypeSchema = z.enum([
  'passport',
  'driving_license',
  'national_insurance_number',
  'social_security_number',
  'tax_identification_number',
  'utility_bill',
  'national_identity_card',
  'visa',
  'polling_card',
  'residence_permit',
  'birth_certificate',
  'bank_statement',
  'change_of_name',
  'tax_document',
  'company_confirmation_statement',
  'company_annual_accounts',
  'company_statement_of_capital',
  'company_change_of_address',
  'company_incorporation',
  'company_change_of_officers',
  'company_change_of_beneficial_owners',
  'unknown',
  'other'
]);
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