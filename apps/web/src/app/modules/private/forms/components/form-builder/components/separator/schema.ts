import { z } from 'zod';
import { BaseLayoutSchema } from '../base-schema';
import { SeparatorConfig } from '@repo/lintelia/schemas';

// Value validation schema generator
export class SeparatorComponentSchema extends BaseLayoutSchema<z.ZodNull, SeparatorConfig> {
  constructor() {
    super(z.null());
  }

  fromConfig(config: SeparatorConfig): this {
    // Separator doesn't need validation as it's just a visual element
    return this;
  }
}