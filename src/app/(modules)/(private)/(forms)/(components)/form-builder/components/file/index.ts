import { FileUp } from 'lucide-react';
import { ComponentDefinition } from '../../types';
import { fileConfigSchema, fileInputSchema, fileOutputSchema } from './schema';
import { FileEditor } from './editor';
import { FileViewer } from './viewer';
import { FileProperties } from './properties';
import { FileToolbar } from './toolbar';

export const fileComponent: ComponentDefinition<
  typeof fileConfigSchema,
  typeof fileInputSchema,
  typeof fileOutputSchema
> = {
  type: 'file',
  label: 'File Upload',
  icon: FileUp,
  category: 'input',
  schema: {
    config: fileConfigSchema,
    input: fileInputSchema,
    output: fileOutputSchema,
  },
  components: {
    Editor: FileEditor,
    Viewer: FileViewer,
    Properties: FileProperties,
    Toolbar: FileToolbar,
  },
}; 