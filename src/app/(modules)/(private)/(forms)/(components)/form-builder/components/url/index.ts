import { Link } from 'lucide-react';
import { ComponentDefinition } from '../../types';
import { urlConfigSchema, urlInputSchema, urlOutputSchema } from './schema';
import { UrlEditor } from './editor';
import { UrlViewer } from './viewer';
import { UrlProperties } from './properties';
import { UrlToolbar } from './toolbar';

export const urlComponent: ComponentDefinition<
  typeof urlConfigSchema,
  typeof urlInputSchema,
  typeof urlOutputSchema
> = {
  type: 'url',
  label: 'URL',
  icon: Link,
  category: 'input',
  schema: {
    config: urlConfigSchema,
    input: urlInputSchema,
    output: urlOutputSchema,
  },
  components: {
    Editor: UrlEditor,
    Viewer: UrlViewer,
    Properties: UrlProperties,
    Toolbar: UrlToolbar,
  },
}; 