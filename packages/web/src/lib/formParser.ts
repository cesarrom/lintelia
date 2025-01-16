
export interface FormField {
  label: string;
  key: string;
  type: string;
  validate?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
  };
  values?: Array<{ label: string; value: string }>;
  id: string;
}

export interface ParsedForm {
  title: string;
  description: string;
  fields: FormField[];
  submitButton: {
    label: string;
    key: string;
    id: string;
  };
}

export function parseForm(form: any): ParsedForm {
  const titleComponent = form.components.find(c => c.type === 'text');
  const [title, description] = titleComponent?.text?.split('\n\n') || ['Banking Application', 'Please fill out the following form.'];

  const fields = form.components.filter(c => !['text', 'button', 'intro', 'outro'].includes(c.type)) as FormField[];

  const submitButton = form.components.find(c => c.type === 'button' && c.action === 'submit');

  return {
    title: title.replace('# ', ''),
    description,
    fields,
    submitButton: submitButton as ParsedForm['submitButton'],
  };
}

