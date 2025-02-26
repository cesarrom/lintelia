import { Star } from 'lucide-react';
import { ComponentDefinition } from '../../types';
import { ratingConfigSchema, ratingInputSchema, ratingOutputSchema } from './schema';
import { RatingEditor } from './editor';
import { RatingViewer } from './viewer';
import { RatingProperties } from './properties';
import { RatingToolbar } from './toolbar';

export const ratingComponent: ComponentDefinition<
  typeof ratingConfigSchema,
  typeof ratingInputSchema,
  typeof ratingOutputSchema
> = {
  type: 'rating',
  label: 'Rating',
  icon: Star,
  category: 'input',
  schema: {
    config: ratingConfigSchema,
    input: ratingInputSchema,
    output: ratingOutputSchema,
  },
  components: {
    Editor: RatingEditor,
    Viewer: RatingViewer,
    Properties: RatingProperties,
    Toolbar: RatingToolbar,
  },
}; 