import { Image } from 'lucide-react';
import { ComponentDefinition } from '../../types';
import { imageConfigSchema, imageInputSchema, imageOutputSchema } from './schema';
import { ImageEditor } from './editor';
import { ImageViewer } from './viewer';
import { ImageProperties } from './properties';
import { ImageToolbar } from './toolbar';

export const imageComponent: ComponentDefinition<
  typeof imageConfigSchema,
  typeof imageInputSchema,
  typeof imageOutputSchema
> = {
  type: 'image',
  label: 'Image Upload',
  icon: Image,
  category: 'input',
  schema: {
    config: imageConfigSchema,
    input: imageInputSchema,
    output: imageOutputSchema,
  },
  components: {
    Editor: ImageEditor,
    Viewer: ImageViewer,
    Properties: ImageProperties,
    Toolbar: ImageToolbar,
  },
}; 