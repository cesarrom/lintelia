import { Star } from 'lucide-react';
import { IFormComponent } from '../../schemas';
import { RatingComponentSchema } from './schema';
import { RatingEditor } from './editor';
import { RatingViewer } from './viewer';
import { RatingProperties } from './properties';
import { RatingToolbar } from './toolbar';
import { RatingConfig, ratingConfigSchema } from '@repo/fintivio/schemas';

/**
 * Rating Component
 * 
 * A star rating input field that supports:
 * - Required/optional
 * - Configurable max rating (1-10)
 * - Optional labels for low and high ratings
 */
export const ratingComponent: IFormComponent = {
  type: 'rating',
  label: 'Rating',
  icon: Star,
  category: 'input',

  // UI Components
  Editor: RatingEditor,
  Viewer: RatingViewer,
  Properties: RatingProperties,
  Toolbar: RatingToolbar,

  // Schema and validation
  getConfigSchema() {
    return ratingConfigSchema;
  },

  createValidationSchema(config: RatingConfig) {
    const schema = new RatingComponentSchema(config.propertyName);
    return schema.fromConfig(config);
  },
}; 