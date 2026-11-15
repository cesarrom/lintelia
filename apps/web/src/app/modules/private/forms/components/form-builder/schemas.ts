import { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { FormComponentConfig, FormConfig, FormVariable } from '@repo/fintivio/schemas';
import { LucideIcon } from 'lucide-react';
import { FormState, UseFormRegister } from 'react-hook-form';
import { BaseComponentSchema, BaseLayoutSchema } from './components/base-schema';
import { z } from 'zod';

// Component Category
export type ComponentCategory = 'input' | 'layout' | 'container';

// Props for the component editor in form builder
export interface EditorProps<TConfig> {
  id: string;
  config: TConfig;
  isSelected?: boolean;
  onSelect?: () => void;
  onConfigChange?: (config: TConfig) => void;
  formComponents?: FormComponentConfig[];
}

// Props for the component viewer in form
export interface ViewerProps<TConfig, TValue> {
  id: string;
  config: TConfig;
  value?: TValue;
  onChange?: (value: TValue) => void;
  onBlur?: () => void;
  error?: string;
  formValues?: Record<string, unknown>;
  register?: UseFormRegister<any>; // For react-hook-form register function
  formState?: FormState<any>; // For react-hook-form formState
  control?: any; // For react-hook-form control
}

// Props for the properties panel
export interface PropertiesProps<TConfig> {
  config: TConfig;
  onChange: (config: TConfig) => void;
}

// Props for the toolbar item
export interface ToolbarProps {
  onDragStart?: (event: DragStartEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  disabled?: boolean;
}

/**
 * Form Component Definition
 * 
 * Each form component must provide:
 * 1. UI Components (Editor, Viewer, Properties, Toolbar)
 * 2. Metadata (type, label, icon, category)
 * 3. Schema and validation methods
 */
export interface IFormComponent {
  // Component metadata
  type: string;
  label: string;
  icon: LucideIcon;
  category: ComponentCategory;

  // UI Components
  Editor: React.ComponentType<EditorProps<any>>;
  Viewer: React.ComponentType<ViewerProps<any, any>>;
  Properties: React.ComponentType<PropertiesProps<any>>;
  Toolbar: React.ComponentType<ToolbarProps>;

  // Schema and validation
  getConfigSchema(): z.ZodType;
  createValidationSchema(config: any): BaseComponentSchema<any, any> | BaseLayoutSchema<any, any>;
}

// Form Engine Props
export interface FormEngineProps {
  mode: 'editor' | 'viewer';
  config: FormConfig;
  initialValues?: Record<string, unknown>;
  variables?: Record<string, unknown>;
  variableDefinitions?: Record<string, FormVariable>;
  onChange?: (values: Record<string, unknown>) => void;
  onSubmit?: (values: Record<string, unknown>) => void;
  onConfigChange?: (config: FormConfig) => void;
  selectedId?: string | null;
  onSelectComponent?: (id: string | null) => void;
  readOnly?: boolean;
}

// Helper function to generate validation config for saving
export function generateValidationConfig(config: FormConfig): FormConfig {
  return {
    ...config,
    validation: {
      schema: {},  // Will be populated by validation.ts
      rules: config.components.reduce((acc, component) => {
        acc[component.id] = {
          ...component.config,
          type: component.type,
        };
        return acc;
      }, {} as Record<string, unknown>),
    },
  };
} 