import { z } from 'zod';
import { BaseLayoutSchema } from '../base-schema';
import { PageSeparatorConfig } from '@repo/fintivio/schemas';

// Value validation schema generator
export class PageSeparatorComponentSchema extends BaseLayoutSchema<z.ZodString, PageSeparatorConfig> {
  constructor(propertyName: string) {
    super(z.string(), propertyName);
  }

  fromConfig(config: PageSeparatorConfig): this {
    // Page separators don't need validation as they're not input fields
    // But we still need to handle required flag for consistency
    return this;
  }
}