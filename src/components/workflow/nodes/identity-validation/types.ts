export type ValidationType = 'id_card' | 'passport' | 'driver_license' | 'national_id';
export type ValidationMethod = 'ocr' | 'mrz' | 'barcode' | 'nfc';

export interface ValidationConfig {
  documentType: ValidationType;
  methods: ValidationMethod[];
  requiredFields: string[];
  allowExpired?: boolean;
  maxExpiryDays?: number;
  allowedCountries?: string[];
  minAge?: number;
  validateAddress?: boolean;
  validateFace?: boolean;
  validateHologram?: boolean;
  validateUv?: boolean;
  validateIr?: boolean;
}

export interface IdentityValidationNodeData {
  name: string;
  description?: string;
  config: ValidationConfig;
} 