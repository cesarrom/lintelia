import { LucideIcon } from 'lucide-react';
import { z } from 'zod';
import { FormVariable, FormConfig } from './schemas';

// Component Category
export type ComponentCategory = 'input' | 'layout' | 'container';

// Base Props
export interface BaseComponentProps<TConfig extends z.ZodType> {
  id: string;
  config: z.infer<TConfig>;
}

// Editor specific props
export interface EditorProps<TConfig extends z.ZodType> extends BaseComponentProps<TConfig> {
  isSelected?: boolean;
  onSelect?: () => void;
  onConfigChange?: (config: z.infer<TConfig>) => void;
  index?: number;
}

// Viewer specific props
export interface ViewerProps<
  TConfig extends z.ZodType,
  TInput extends z.ZodType,
  TOutput extends z.ZodType
> extends BaseComponentProps<TConfig> {
  id: string;
  value?: z.infer<TInput>;
  onChange?: (value: z.infer<TOutput>) => void;
  onBlur?: () => void;
  error?: string;
  index?: number;
}

// Properties panel props
export interface PropertiesProps<TConfig extends z.ZodType> {
  config: z.infer<TConfig>;
  onChange: (config: z.infer<TConfig>) => void;
}

// Toolbar props
export interface ToolbarProps {
  onDragStart?: () => void;
  onDragEnd?: () => void;
  disabled?: boolean;
}

// Component Definition
export interface ComponentDefinition<
  TConfig extends z.ZodType,
  TInput extends z.ZodType,
  TOutput extends z.ZodType
> {
  type: string;
  label: string;
  icon: LucideIcon;
  category: ComponentCategory;
  schema: {
    config: TConfig;
    input: TInput;
    output: TOutput;
  };
  components: {
    Editor: React.FC<EditorProps<TConfig>>;
    Viewer: React.FC<ViewerProps<TConfig, TInput, TOutput>>;
    Properties: React.FC<PropertiesProps<TConfig>>;
    Toolbar: React.FC<ToolbarProps>;
  };
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
}

export const baseComponentSchema = z.object({
  id: z.string(),
  type: z.string(),
  config: z.object({}),
}); 