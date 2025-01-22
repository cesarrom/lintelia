export type FieldType =
  | 'text'
  | 'number'
  | 'email'
  | 'password'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'radio'
  | 'date'
  | 'time'
  | 'datetime'
  | 'file'
  | 'phone'
  | 'url'
  | 'color'
  | 'range'
  | 'rating'
  | 'section'
  | 'columns'
  | 'page-separator';

export type ValidationRuleType = 'required' | 'min' | 'max' | 'minLength' | 'maxLength' | 'pattern' | 'custom';

export interface ValidationRule {
  type: ValidationRuleType;
  value?: number | string | boolean | RegExp;
  message: string;
}

export interface FieldOption {
  label: string;
  value: string;
}

export interface FormField {
  id: string;
  type: FieldType;
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string | number | boolean | string[];
  description?: string;
  required?: boolean;
  validation?: ValidationRule[];
  options?: FieldOption[];
  columns?: FormField[][];  // For column layouts
  fields?: FormField[];     // For sections
  className?: string;
  style?: React.CSSProperties;
  hidden?: boolean;
  disabled?: boolean;
  dependencies?: {
    field: string;
    value: string | number | boolean;
    action: 'show' | 'hide' | 'enable' | 'disable';
  }[];
}

export interface FormNodeData {
  name: string;
  description?: string;
  fields: FormField[];
  layout?: 'vertical' | 'horizontal';
  submitButtonText?: string;
  cancelButtonText?: string;
} 