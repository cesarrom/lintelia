export interface FormFieldConfig {
  id: string;
  type: 'text' | 'number' | 'email' | 'textarea' | 'select' | 'checkbox' | 'radio';
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  options?: Array<{
    label: string;
    value: string;
  }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

export interface FormConfig {
  id?: string;
  name: string;
  description?: string;
  fields: FormFieldConfig[];
  submitButtonText?: string;
  successMessage?: string;
  createdAt?: string;
  updatedAt?: string;
} 