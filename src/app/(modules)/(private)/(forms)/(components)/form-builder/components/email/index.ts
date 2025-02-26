import { Mail } from 'lucide-react';
import { ComponentDefinition } from '../../types';
import { emailConfigSchema, emailInputSchema, emailOutputSchema } from './schema';
import { EmailEditor } from './editor';
import { EmailViewer } from './viewer';
import { EmailProperties } from './properties';
import { EmailToolbar } from './toolbar';

export const emailComponent: ComponentDefinition<
  typeof emailConfigSchema,
  typeof emailInputSchema,
  typeof emailOutputSchema
> = {
  type: 'email',
  label: 'Email',
  icon: Mail,
  category: 'input',
  schema: {
    config: emailConfigSchema,
    input: emailInputSchema,
    output: emailOutputSchema,
  },
  components: {
    Editor: EmailEditor,
    Viewer: EmailViewer,
    Properties: EmailProperties,
    Toolbar: EmailToolbar,
  },
}; 