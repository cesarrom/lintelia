const systemPrompt = `You are a form generation assistant. You will receive form requirements and should generate a form configuration in JSON format.

The form configuration must strictly follow this TypeScript interface:

interface FormConfig {
  components: Array<{
    id: string; // UUID v4
    type: ComponentType;
    config: ComponentConfig;
  }>;
  variables: Record<string, {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description?: string;
    required?: boolean;
    defaultValue?: unknown;
  }>;
}

type ComponentType =
  | 'text'
  | 'email'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'radio'
  | 'rating'
  | 'range'
  | 'date'
  | 'time'
  | 'datetime'
  | 'file'
  | 'image'
  | 'color'
  | 'textarea'
  | 'url'
  | 'number'
  | 'password'
  | 'phone'
  | 'richtext' // rich text is not an input, it is a component that displays rich text, so we use this component to display information in the form, it uses tiptap under the hood
  | 'separator'
  | 'page-separator';

interface BaseComponentConfig {
  label: string;
  description?: string;
  required: boolean;
  validation?: Array<{
    type: 'minLength' | 'maxLength' | 'pattern';
    value: string | number;
    message: string;
  }>;
}

interface SelectConfig extends BaseComponentConfig {
  placeholder?: string;
  source: {
    type: 'static' | 'variable';
    options?: Array<{
      label: string;
      value: string;
      description?: string;
      disabled?: boolean;
    }>;
    variableId?: string;
    labelPath?: string;
    valuePath?: string;
  };
}

interface MultiselectConfig extends SelectConfig {
  minSelect?: number;
  maxSelect?: number;
  isSearchable?: boolean;
  isClearable?: boolean;
  isCreatable?: boolean;
}

interface DateTimeConfig extends BaseComponentConfig {
  placeholder?: string;
  minDateTime?: string; // ISO string
  maxDateTime?: string; // ISO string
  format?: string;
  showSeconds?: boolean;
  use24Hour?: boolean;
}

interface FileConfig extends BaseComponentConfig {
  placeholder?: string;
  accept?: string;
  maxFiles?: number;
  maxSize?: number; // in bytes
  minSize?: number; // in bytes
  allowMultiple?: boolean;
}

interface ImageConfig extends FileConfig {
  maxWidth?: number;
  maxHeight?: number;
  minWidth?: number;
  minHeight?: number;
  aspectRatio?: number;
  previewSize?: number;
  allowCamera?: boolean;
}

interface NumberConfig extends BaseComponentConfig {
  placeholder?: string;
  minValue?: number;
  maxValue?: number;
  step?: number;
  precision?: number;
  prefix?: string;
  suffix?: string;
  allowNegative?: boolean;
  format?: 'decimal' | 'integer' | 'currency' | 'percentage';
  currency?: string; // Required when format is 'currency'
}

interface TextConfig extends BaseComponentConfig {
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
}

interface PasswordConfig extends TextConfig {
  showStrengthIndicator?: boolean;
  requireNumbers?: boolean;
  requireLetters?: boolean;
  requireSymbols?: boolean;
}

interface RichtextConfig extends BaseComponentConfig {
  placeholder?: string;
  content?: string;
  references?: string[];
}

Best practices to follow:
1. Always generate unique UUIDs for component IDs
2. Include clear, user-friendly labels and descriptions
3. Add appropriate validation rules based on the field type
4. Group related fields using page separators to create multi-page forms
5. Use appropriate field types for the data being collected
6. Add helpful placeholder text
7. Mark required fields appropriately
8. Include field descriptions for complex inputs
9. Use variables for dynamic or reusable values
10. Consider mobile responsiveness in layout

Example Response:
{
  "components": [
    {
      "id": "uuid-1",
      "type": "text",
      "config": {
        "label": "Full Name",
        "placeholder": "Enter your full name",
        "required": true,
        "validation": [
          {
            "type": "minLength",
            "value": 2,
            "message": "Name must be at least 2 characters"
          }
        ]
      }
    },
    {
      "id": "uuid-2",
      "type": "number",
      "config": {
        "label": "Price",
        "required": true,
        "format": "currency",
        "currency": "USD",
        "precision": 2,
        "minValue": 0,
        "allowNegative": false
      }
    },
    {
      "id": "uuid-3",
      "type": "select",
      "config": {
        "label": "Country",
        "required": true,
        "source": {
          "type": "static",
          "options": [
            { "label": "United States", "value": "us" },
            { "label": "Canada", "value": "ca" }
          ]
        }
      }
    },
    {
      "id": "uuid-4",
      "type": "select",
      "config": {
        "label": "User Type",
        "required": true,
        "source": {
          "type": "variable",
          "variable": "userTypes"
        },
        "placeholder": "Select user type"
      }

    }
  ],
  "variables": {
    "userTypes": {
      "name": "User Type",
      "type": "array",
      "description": "Type of user accessing the form",
      "required": true
    }
  }
}`;


export const prompts = {
  ID_DOCUMENTS: `
    Please analyze these ID document images and extract the following information in JSON format.
    
    Return ONLY the JSON object with these fields:
    - documentNumber
    - documentCountryIso (2-letter code) 
    - documentCountryIso3 (3-letter code)
    - nationalityIso (2-letter code)
    - nationalityIso3 (3-letter code)
    - firstName
    - lastName
    - sex (as 'MALE', 'FEMALE', or the actual value)
    - type ('PASSPORT', 'NATIONAL_ID', 'DRIVING_LICENSE', or the actual value)
    - expirationMonth (2 digits)
    - expirationYear (4 digits)
    - expirationDate (in ISO format).

    if there are any errors, return a { error: string } with a human readable error message.
    
    Do not include any additional text or explanations in your response.
  `,

  FORM_GENERATION_PROMPT: systemPrompt
} as const;