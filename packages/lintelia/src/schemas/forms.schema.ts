import { z } from 'zod';

export const baseConfigSchema = z.object({
  propertyName: z.string()
    .min(1, 'Property name is required')
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Property name must start with a letter and can only contain letters, numbers, and underscores'),
  required: z.boolean().default(false),
});

export type BaseConfig = z.infer<typeof baseConfigSchema>;

export const checkboxConfigSchema = baseConfigSchema.extend({
  type: z.literal('checkbox'),
  label: z.string().optional(),
  description: z.string().optional(),
  text: z.string().default('Checkbox'),
  defaultChecked: z.boolean().default(false),
});

export type CheckboxConfig = z.infer<typeof checkboxConfigSchema>;

export const colorConfigSchema = baseConfigSchema.extend({
  type: z.literal('color'),
  label: z.string().min(1, 'Label is required'),
  placeholder: z.string().optional().default(''),
  description: z.string().optional().default(''),
  defaultValue: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color').optional(),
  format: z.enum(['hex', 'rgb']).default('hex'),
  validation: z.object({
    pattern: z.string().optional(),
  }).optional().default({}),
});

export type ColorConfig = z.infer<typeof colorConfigSchema>;

export const dateConfigSchema = baseConfigSchema.extend({
  type: z.literal('date'),
  label: z.string().min(1, 'Label is required'),
  placeholder: z.string().optional().default(''),
  description: z.string().optional().default(''),
  defaultValue: z.string().date().optional(),
  validation: z.object({
    minDate: z.string().date().optional(),
    maxDate: z.string().date().optional(),
  }).optional().default({}),
});

export type DateConfig = z.infer<typeof dateConfigSchema>;

export const datetimeConfigSchema = baseConfigSchema.extend({
  type: z.literal('datetime'),
  label: z.string().min(1, 'Label is required'),
  description: z.string().optional().default(''),
  placeholder: z.string().optional().default(''),
  format: z.enum(['date', 'datetime', 'time']).default('datetime'),
  validation: z.object({
    min: z.string().datetime().optional(),
    max: z.string().datetime().optional(),
  }).optional().default({}),
});

export type DatetimeConfig = z.infer<typeof datetimeConfigSchema>;

export const emailConfigSchema = baseConfigSchema.extend({
  type: z.literal('email'),
  label: z.string().min(1, 'Label is required'),
  placeholder: z.string().optional().default(''),
  description: z.string().optional().default(''),
  validation: z.object({
    pattern: z.string().optional(), // Additional email pattern if needed
  }).optional().default({}),
});

export type EmailConfig = z.infer<typeof emailConfigSchema>;

export const fileConfigSchema = baseConfigSchema.extend({
  type: z.literal('file'),
  label: z.string().min(1, 'Label is required'),
  description: z.string().optional().default(''),
  accept: z.string().optional().default('*/*'),
  multiple: z.boolean().default(false),
  maxSize: z.number().optional(), // in bytes
  validation: z.object({
    minFiles: z.number().optional(),
    maxFiles: z.number().optional(),
    allowedTypes: z.array(z.string()).optional(),
  }).optional().default({}),
});

export type FileConfig = z.infer<typeof fileConfigSchema>;

export const imageConfigSchema = baseConfigSchema.extend({
  type: z.literal('image'),
  label: z.string().min(1, 'Label is required'),
  description: z.string().optional().default(''),
  accept: z.array(z.string()).default(['.jpg', '.jpeg', '.png', '.gif']),
  maxSize: z.number().min(0).default(4 * 1024 * 1024), // 5MB default
  validation: z.object({
    minWidth: z.number().optional(),
    maxWidth: z.number().optional(),
    minHeight: z.number().optional(),
    maxHeight: z.number().optional(),
    aspectRatio: z.number().optional(),
  }).optional().default({}),
});

export type ImageConfig = z.infer<typeof imageConfigSchema>;

export const selectOption = z.object({
  label: z.string(),
  value: z.string(),
});

export type SelectOption = z.infer<typeof selectOption>;

// Schema for options source configuration
export const optionsSourceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('static'),
    options: z.array(selectOption),
  }),
  z.object({
    type: z.literal('variable'),
    variableName: z.string(),
    labelPath: z.string().optional(),
    valuePath: z.string().optional(),
  }),
]);

export type OptionsSource = z.infer<typeof optionsSourceSchema>;

// Form builder config schema
export const multiselectConfigSchema = baseConfigSchema.extend({
  type: z.literal('multiselect'),
  label: z.string().min(1, 'Label is required'),
  placeholder: z.string().optional().default(''),
  description: z.string().optional().default(''),
  source: optionsSourceSchema,
  defaultValue: z.array(z.string()).optional().default([]),
  minSelect: z.number().min(0).optional(),
  maxSelect: z.number().min(0).optional(),
  searchable: z.boolean().default(false),
  creatable: z.boolean().default(false),
});

export type MultiselectConfig = z.infer<typeof multiselectConfigSchema>;

export const selectConfigSchema = baseConfigSchema.extend({
  type: z.literal('select'),
  label: z.string().min(1, 'Label is required'),
  placeholder: z.string().optional().default('Select an option'),
  description: z.string().optional().default(''),
  source: optionsSourceSchema.default({
    type: 'static',
    options: [],
  }),
});

export type SelectConfig = z.infer<typeof selectConfigSchema>;

export const numberConfigSchema = baseConfigSchema.extend({
  type: z.literal('number'),
  label: z.string().min(1, 'Label is required'),
  placeholder: z.string().optional().default(''),
  description: z.string().optional().default(''),
  defaultValue: z.number().optional(),
  validation: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().positive().optional(),
    precision: z.number().int().min(0).max(10).optional(),
  }).optional().default({}),
});

export type NumberConfig = z.infer<typeof numberConfigSchema>;

export const pageSeparatorConfigSchema = z.object({
  type: z.literal('pageSeparator'),
  title: z.string().min(1, 'Title is required').default('New Page'),
  description: z.string().optional().default(''),
});

export type PageSeparatorConfig = z.infer<typeof pageSeparatorConfigSchema>;

export const passwordConfigSchema = baseConfigSchema.extend({
  type: z.literal('password'),
  label: z.string().min(1, 'Label is required'),
  placeholder: z.string().optional().default(''),
  description: z.string().optional().default(''),
  showToggle: z.boolean().default(true),
  showStrengthIndicator: z.boolean().default(false),
  validation: z.object({
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    pattern: z.string().optional(),
  }).optional().default({}),
});

export type PasswordConfig = z.infer<typeof passwordConfigSchema>;

export const phoneConfigSchema = baseConfigSchema.extend({
  type: z.literal('phone'),
  label: z.string().min(1, 'Label is required'),
  placeholder: z.string().optional().default('Enter your phone number'),
  description: z.string().optional().default(''),
  format: z.enum(['international', 'national']).default('international'),
  defaultCountry: z.string().default('US'),
});

export type PhoneConfig = z.infer<typeof phoneConfigSchema>;

export const radioOptionSchema = z.object({
  label: z.string().min(1, 'Option label is required'),
  value: z.string().min(1, 'Option value is required'),
});

export type RadioOption = z.infer<typeof radioOptionSchema>;

// Form builder config schema
export const radioConfigSchema = baseConfigSchema.extend({
  type: z.literal('radio'),
  label: z.string().min(1, 'Label is required'),
  description: z.string().optional().default(''),
  options: z.array(radioOptionSchema).min(1, 'At least one option is required').default([]),
  defaultValue: z.string().optional(),
  layout: z.enum(['horizontal', 'vertical']).default('vertical'),
});

export type RadioConfig = z.infer<typeof radioConfigSchema>;

export const rangeConfigSchema = baseConfigSchema.extend({
  type: z.literal('range'),
  label: z.string().min(1, 'Label is required'),
  description: z.string().optional().default(''),
  min: z.number().default(0),
  max: z.number().default(100),
  step: z.number().default(1),
  defaultValue: z.number().optional().default(0),
  showValue: z.boolean().default(true),
});

export type RangeConfig = z.infer<typeof rangeConfigSchema>;

export const ratingConfigSchema = baseConfigSchema.extend({
  type: z.literal('rating'),
  label: z.string().min(1, 'Label is required'),
  description: z.string().optional().default(''),
  maxRating: z.number().min(1).max(10).default(5),
  showLabels: z.boolean().default(false),
  lowLabel: z.string().optional().default('Poor'),
  highLabel: z.string().optional().default('Excellent'),
});

export type RatingConfig = z.infer<typeof ratingConfigSchema>;

// Define the variable reference schema
export const variableReferenceSchema = z.object({
  type: z.literal('variable'),
  id: z.string(),
  path: z.string().optional(),
  label: z.string(),
});

export type VariableReference = z.infer<typeof variableReferenceSchema>;

export const _commonReferenceSchema = z.object({
  
  id: z.string(),
  label: z.string(),
});

export const fieldReference = _commonReferenceSchema.extend({
  type: z.literal('field'),
});

export const systemVariableReference = _commonReferenceSchema.extend({
  type: z.literal('system'),
})


export type FieldReference = z.infer<typeof fieldReference>;
export type SystemVariableReference = z.infer<typeof systemVariableReference>;

export const referenceUnionSchema = z.discriminatedUnion('type', [
  variableReferenceSchema,
  fieldReference,
  systemVariableReference,
]);

export type ReferenceUnion = z.infer<typeof referenceUnionSchema>;

// Form builder config schema
export const richtextConfigSchema = baseConfigSchema.extend({
  type: z.literal('richText'),
  label: z.string().min(1, 'Label is required'),
  placeholder: z.string().optional().default(''),
  description: z.string().optional().default(''),
  content: z.string().optional().default(''),
  references: z.array(referenceUnionSchema).optional().default([]),
  enableVariables: z.boolean().optional().default(true),
  enableFieldReferences: z.boolean().optional().default(true),
  enableSystemVariables: z.boolean().optional().default(true),
});

export type RichtextConfig = z.infer<typeof richtextConfigSchema>;

export const separatorConfigSchema = z.object({
  type: z.literal('separator'),
  title: z.string().optional().default(''),
  showTitle: z.boolean().default(false),
});

export type SeparatorConfig = z.infer<typeof separatorConfigSchema>;

export const textConfigSchema = baseConfigSchema.extend({
  type: z.literal('text'),
  label: z.string().min(1, 'Label is required'),
  placeholder: z.string().optional().default(''),
  description: z.string().optional().default(''),
  validation: z.object({
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    pattern: z.string().optional(),
  }).optional().default({}),
});

export type TextConfig = z.infer<typeof textConfigSchema>;

export const textareaConfigSchema = baseConfigSchema.extend({
  type: z.literal('textarea'),
  label: z.string().min(1, 'Label is required'),
  placeholder: z.string().optional().default(''),
  description: z.string().optional().default(''),
  rows: z.number().min(2).default(4),
  validation: z.object({
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    pattern: z.string().optional(),
  }).optional().default({}),
});

export type TextareaConfig = z.infer<typeof textareaConfigSchema>;

export const timeConfigSchema = baseConfigSchema.extend({
  type: z.literal('time'),
  label: z.string().min(1, 'Label is required'),
  placeholder: z.string().optional().default('Select time'),
  description: z.string().optional().default(''),
  min: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format').optional(),
  max: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format').optional(),
  step: z.number().optional().default(60),
});

export type TimeConfig = z.infer<typeof timeConfigSchema>;

export const urlConfigSchema = baseConfigSchema.extend({
  type: z.literal('url'),
  label: z.string().min(1, 'Label is required'),
  placeholder: z.string().optional().default('Enter URL'),
  description: z.string().optional().default(''),
  prefix: z.string().optional().default('https://'),
});

export type UrlConfig = z.infer<typeof urlConfigSchema>;

export const formVariableSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
  description: z.string().optional(),
  required: z.boolean().optional(),
  defaultValue: z.unknown().optional(),
});

export type FormVariable = z.infer<typeof formVariableSchema>;

// Form component schema
export const formComponentSchema = z.object({
  id: z.string(),
  type: z.string(),
  config: z.discriminatedUnion('type', [
    checkboxConfigSchema,
    colorConfigSchema,
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

export type FormComponentConfig = Omit<z.infer<typeof formComponentSchema>, 'type'> & { type: z.infer<typeof formComponentSchema>['config']['type'] }

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

export type FormConfig = Omit<z.infer<typeof formConfigSchema>, 'components'> & { components: FormComponentConfig[] }