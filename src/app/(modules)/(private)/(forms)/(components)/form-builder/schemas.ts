import { z } from 'zod';
import { LucideIcon } from 'lucide-react';
import { BaseComponentSchema } from './components/base-schema';
import { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { FormState, UseFormRegister } from 'react-hook-form';
import { checkboxConfigSchema } from './components/checkbox/schema';
import { colorConfigSchema } from './components/color/schema';
import { dateConfigSchema } from './components/date/schema';
import { datetimeConfigSchema } from './components/datetime/schema';
import { emailConfigSchema } from './components/email/schema';
import { fileConfigSchema } from './components/file/schema';
import { imageConfigSchema } from './components/image/schema';
import { multiselectConfigSchema } from './components/multiselect/schema';
import { numberConfigSchema } from './components/number/schema';
import { pageSeparatorConfigSchema } from './components/page-separator/schema';
import { passwordConfigSchema } from './components/password/schema';
import { phoneConfigSchema } from './components/phone/schema';
import { radioConfigSchema } from './components/radio/schema';
import { rangeConfigSchema } from './components/range/schema';
import { ratingConfigSchema } from './components/rating/schema';
import { richtextConfigSchema } from './components/richtext/schema';
import { selectConfigSchema } from './components/select/schema';
import { separatorConfigSchema } from './components/separator/schema';
import { textConfigSchema } from './components/text/schema';
import { textareaConfigSchema } from './components/textarea/schema';
import { timeConfigSchema } from './components/time/schema';
import { urlConfigSchema } from './components/url/schema';

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
  config: z.discriminatedUnion('type', [
    colorConfigSchema,
    checkboxConfigSchema,
    dateConfigSchema,
    datetimeConfigSchema,
    emailConfigSchema,
    fileConfigSchema,
    imageConfigSchema,
    multiselectConfigSchema,
    numberConfigSchema,
    pageSeparatorConfigSchema,
    passwordConfigSchema,
    phoneConfigSchema,
    radioConfigSchema,
    rangeConfigSchema,
    ratingConfigSchema,
    richtextConfigSchema,
    selectConfigSchema,
    separatorConfigSchema,
    textConfigSchema,
    textareaConfigSchema,
    timeConfigSchema,
    urlConfigSchema
  ])
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
export type FormVariable = z.infer<typeof formVariableSchema>;

export type FormComponentConfig = Omit<z.infer<typeof formComponentSchema>, 'type'> & { type: z.infer<typeof formComponentSchema>['config']['type'] }

export type FormConfig = Omit<z.infer<typeof formConfigSchema>, 'components'> & { components: FormComponentConfig[] }

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
          ...component.config,
          type: component.type,
        };
        return acc;
      }, {} as Record<string, unknown>),
    },
  };
} 