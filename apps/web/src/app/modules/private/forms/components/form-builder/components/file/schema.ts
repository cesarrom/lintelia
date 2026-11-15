import { z } from 'zod';
import { BaseComponentSchema } from '../base-schema';
import { FileConfig } from '@repo/fintivio/schemas';

// Value validation schema generator
export class FileComponentSchema extends BaseComponentSchema<z.ZodArray<z.ZodObject<any>>, FileConfig> {
  constructor(propertyName: string) {
    // Base schema for a file object
    const fileSchema = z.object({
      name: z.string(),
      size: z.number(),
      type: z.string(),
      lastModified: z.number(),
    });

    super(z.array(fileSchema), propertyName);
  }

  setMinFiles(min: number | undefined): this {
    if (min !== undefined && min > 0) {
      this.schema = this.schema.min(min, `At least ${min} file(s) required`);
    }
    return this;
  }

  setMaxFiles(max: number | undefined): this {
    if (max !== undefined && max > 0) {
      this.schema = this.schema.max(max, `Maximum ${max} file(s) allowed`);
    }
    return this;
  }

  setAllowedTypes(types: string[] | undefined): this {
    if (types && types.length > 0) {
      this.schema = this.schema.refine(
        (files) => files.every(file => types.some(type => 
          file.type.match(new RegExp(type.replace('*', '.*')))
        )),
        { message: `Only ${types.join(', ')} files are allowed` }
      ) as any;
    }
    return this;
  }

  fromConfig(config: FileConfig): this {
    this.setRequired(config.required);
    
    if (config.validation?.minFiles) {
      this.setMinFiles(config.validation.minFiles);
    }
    if (config.validation?.maxFiles) {
      this.setMaxFiles(config.validation.maxFiles);
    }
    if (config.validation?.allowedTypes) {
      this.setAllowedTypes(config.validation.allowedTypes);
    }
    
    return this;
  }
}
