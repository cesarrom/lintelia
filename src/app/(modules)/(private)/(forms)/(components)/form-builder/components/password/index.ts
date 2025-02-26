import { Lock } from 'lucide-react';
import { ComponentDefinition } from '../../types';
import { passwordConfigSchema, passwordInputSchema, passwordOutputSchema } from './schema';
import { PasswordEditor } from './editor';
import { PasswordViewer } from './viewer';
import { PasswordProperties } from './properties';
import { PasswordToolbar } from './toolbar';

export const passwordComponent: ComponentDefinition<
  typeof passwordConfigSchema,
  typeof passwordInputSchema,
  typeof passwordOutputSchema
> = {
  type: 'password',
  label: 'Password',
  icon: Lock,
  category: 'input',
  schema: {
    config: passwordConfigSchema,
    input: passwordInputSchema,
    output: passwordOutputSchema,
  },
  components: {
    Editor: PasswordEditor,
    Viewer: PasswordViewer,
    Properties: PasswordProperties,
    Toolbar: PasswordToolbar,
  },
}; 