export interface FormFieldConfig {
  id: string;
  type: 'text' | 'number' | 'email' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'richtext' | 'multiselect';
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  description?: string;
  options?: Array<{
    label: string;
    value: string;
    description?: string;
    disabled?: boolean;
  }>;
  source?: {
    type: 'static' | 'variable';
    variable?: string;
    labelPath?: string;
    valuePath?: string;
  };
  content?: string;
  references?: string[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
    minItems?: number;
    maxItems?: number;
  };
  isSearchable?: boolean;
  isClearable?: boolean;
  isCreatable?: boolean;
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