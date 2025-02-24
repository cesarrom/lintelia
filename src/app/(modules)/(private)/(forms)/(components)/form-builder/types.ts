import { LucideIcon } from 'lucide-react';

export type FieldType = 
  | 'text'
  | 'number'
  | 'email'
  | 'password'
  | 'checkbox'
  | 'radio'
  | 'select'
  | 'multiselect'
  | 'date'
  | 'time'
  | 'datetime'
  | 'file'
  | 'color'
  | 'separator'
  | 'columns'
  | 'page-separator'
  | 'phone'
  | 'range'
  | 'rating'
  | 'url'
  | 'image';

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: string }>;
  config?: Record<string, unknown>;
  description?: string;
}

export interface FormComponentProps {
  field: FormField;
  onSelect?: () => void;
  isSelected?: boolean;
  onChange?: (field: FormField) => void;
}

export interface FormComponentDefinition {
  type: FieldType;
  label: string;
  icon: LucideIcon;
  toolbar: React.ComponentType;
  canvas: React.ComponentType<FormComponentProps>;
  properties: React.ComponentType<FormComponentProps>;
}

export interface FormComponentToolbarProps {
  type: FieldType;
  label: string;
  icon: LucideIcon;
  config?: Record<string, unknown>;
} 

export interface FormConfig {
  id: string;
  name: string;
  description?: string;
  fields: FormField[];
  submitButtonText?: string;
  cancelButtonText?: string;
  layout?: 'vertical' | 'horizontal';
  className?: string;
  style?: React.CSSProperties;
} 