export type DocumentType = 'id_card' | 'passport' | 'driver_license' | 'national_id' | 'utility_bill' | 'bank_statement';
export type ExtractionMethod = 'ocr' | 'mrz' | 'barcode' | 'template_matching' | 'ml_model';

export interface FieldExtraction {
  name: string;
  label: string;
  type: 'text' | 'date' | 'number' | 'boolean' | 'image';
  required: boolean;
  method: ExtractionMethod;
  template?: {
    region?: { x: number; y: number; width: number; height: number };
    pattern?: string;
    preprocessors?: string[];
  };
}

export interface DocumentExtractionConfig {
  documentType: DocumentType;
  methods: ExtractionMethod[];
  fields: FieldExtraction[];
  preprocessors?: string[];
  validateExtraction?: boolean;
  confidenceThreshold?: number;
  outputFormat?: 'json' | 'xml' | 'csv';
  includeOriginalImage?: boolean;
  includeFieldImages?: boolean;
}

export interface DocumentExtractorNodeData {
  name: string;
  description?: string;
  config: DocumentExtractionConfig;
} 