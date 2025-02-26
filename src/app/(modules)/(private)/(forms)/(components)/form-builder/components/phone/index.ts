import { Phone } from 'lucide-react';
import { ComponentDefinition } from '../../types';
import { phoneConfigSchema, phoneInputSchema, phoneOutputSchema } from './schema';
import { PhoneEditor } from './editor';
import { PhoneViewer } from './viewer';
import { PhoneProperties } from './properties';
import { PhoneToolbar } from './toolbar';

export const phoneComponent: ComponentDefinition<
  typeof phoneConfigSchema,
  typeof phoneInputSchema,
  typeof phoneOutputSchema
> = {
  type: 'phone',
  label: 'Phone',
  icon: Phone,
  category: 'input',
  schema: {
    config: phoneConfigSchema,
    input: phoneInputSchema,
    output: phoneOutputSchema,
  },
  components: {
    Editor: PhoneEditor,
    Viewer: PhoneViewer,
    Properties: PhoneProperties,
    Toolbar: PhoneToolbar,
  },
}; 