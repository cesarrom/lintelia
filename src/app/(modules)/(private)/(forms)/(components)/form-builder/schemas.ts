import { z } from 'zod';
import { LucideIcon } from 'lucide-react';
import { BaseComponentSchema } from './components/base-schema';
import { DragStartEvent, DragEndEvent } from '@dnd-kit/core';

// Component Category
export type ComponentCategory = 'input' | 'layout' | 'container';

// Props for the component editor in form builder
export interface EditorProps<TConfig> {
  id: string;
  config: TConfig;
  isSelected?: boolean;
  onSelect?: () => void;
  onConfigChange?: (config: TConfig) => void;
}

// Props for the component viewer in form
export interface ViewerProps<TConfig, TValue> {
  id: string;
  config: TConfig;
  value?: TValue;
  onChange?: (value: TValue) => void;
  onBlur?: () => void;
  error?: string;
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
  createValidationSchema(config: any): BaseComponentSchema<any, any>;
}

// Variable schema
export const formVariableSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
  description: z.string().optional(),
  required: z.boolean().optional(),
  defaultValue: z.unknown().optional(),
});

// Form component schema
export const formComponentSchema = z.object({
  id: z.string(),
  type: z.string(),
  config: z.record(z.string(), z.unknown()),
});

// Complete form schema
export const formConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  variables: z.record(z.string(), formVariableSchema).default({}),
  components: z.array(formComponentSchema).default([]),
  validation: z.object({
    schema: z.record(z.string(), z.unknown()),
    rules: z.record(z.string(), z.unknown()),
  }).optional(),
});

// Types
export type FormVariable = {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  required?: boolean;
  defaultValue?: unknown;
};

export type FormComponentConfig = {
  id: string;
  type: string;
  config: Record<string, unknown>;
};

export type FormConfig = {
  id: string;
  name: string;
  description?: string;
  variables: Record<string, FormVariable>;
  components: FormComponentConfig[];
  validation?: {
    schema: Record<string, unknown>;  // Serialized validation schema
    rules: Record<string, unknown>;   // Component-specific validation rules
  };
};

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
}

// Helper function to generate validation config for saving
export function generateValidationConfig(config: FormConfig): FormConfig {
  return {
    ...config,
    validation: {
      schema: {},  // Will be populated by validation.ts
      rules: config.components.reduce((acc, component) => {
        acc[component.id] = {
          type: component.type,
          ...component.config,
        };
        return acc;
      }, {} as Record<string, unknown>),
    },
  };
} 