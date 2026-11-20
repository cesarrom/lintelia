import { z } from 'zod';
import { BaseComponentSchema } from '../base-schema';
import { ImageConfig } from '@repo/lintelia/schemas';

// Value validation schema generator
export class ImageComponentSchema extends BaseComponentSchema<z.ZodString, ImageConfig> {
  constructor(propertyName: string) {
    // Create a base schema that accepts both URLs and data URLs
    const baseSchema = z.string()
    
    // Cast to ZodString since we know it will always produce a string
    super(baseSchema as unknown as z.ZodString, propertyName);
  }

  setDimensions(config: ImageConfig): this {
    const { validation } = config;
    if (!validation) return this;

    if (validation.minWidth || validation.maxWidth || validation.minHeight || validation.maxHeight || validation.aspectRatio) {
      // Cast the refined schema back to ZodString
      this.schema = this.schema.superRefine(async (value, ctx) => {
        if (!value) return;

        try {
          const img = new Image();
          img.src = value;

          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              const { width, height } = img;
              
              if (validation.minWidth && width < validation.minWidth) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: `Image width must be at least ${validation.minWidth}px`,
                });
              }

              if (validation.maxWidth && width > validation.maxWidth) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: `Image width must not exceed ${validation.maxWidth}px`,
                });
              }

              if (validation.minHeight && height < validation.minHeight) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: `Image height must be at least ${validation.minHeight}px`,
                });
              }

              if (validation.maxHeight && height > validation.maxHeight) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: `Image height must not exceed ${validation.maxHeight}px`,
                });
              }

              if (validation.aspectRatio) {
                const ratio = width / height;
                const tolerance = 0.01; // 1% tolerance for aspect ratio
                if (Math.abs(ratio - validation.aspectRatio) > tolerance) {
                  ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Image must have an aspect ratio of ${validation.aspectRatio}`,
                  });
                }
              }

              resolve();
            };

            img.onerror = () => {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Failed to load image',
              });
              reject();
            };
          });
        } catch (error) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Invalid image',
          });
        }
      }) as unknown as z.ZodString;
    }

    return this;
  }

  fromConfig(config: ImageConfig): this {
    // Apply validation rules from config
    this.setRequired(config.required);
    this.setDimensions(config);
    return this;
  }
}
