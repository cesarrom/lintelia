import { z } from 'zod';
import { BaseComponentSchema } from '../base-schema';
import { MultiselectConfig } from '@repo/lintelia/schemas';


// Value validation schema generator
export class MultiselectComponentSchema extends BaseComponentSchema<z.ZodArray<z.ZodString>, MultiselectConfig> {
  constructor(propertyName: string) {
    super(z.array(z.string()), propertyName);
  }

  setMinSelect(min: number | undefined): this {
    if (min !== undefined && min > 0) {
      this.schema = this.schema.min(min, `Select at least ${min} option${min !== 1 ? 's' : ''}`);
    }
    return this;
  }

  setMaxSelect(max: number | undefined): this {
    if (max !== undefined && max > 0) {
      this.schema = this.schema.max(max, `Select at most ${max} option${max !== 1 ? 's' : ''}`);
    }
    return this;
  }

  fromConfig(config: MultiselectConfig): this {
    this.setRequired(config.required);
    this.setMinSelect(config.minSelect);
    this.setMaxSelect(config.maxSelect);
    return this;
  }
}