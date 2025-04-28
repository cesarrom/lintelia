import { z } from 'zod';
import { BaseComponentSchema, baseConfigSchema } from '../base-schema';

// Form builder config schema
export const imageConfigSchema = baseConfigSchema.extend({
  type: z.literal('image'),
  label: z.string().min(1, 'Label is required'),
  description: z.string().optional().default(''),
  accept: z.array(z.string()).default(['.jpg', '.jpeg', '.png', '.gif']),
  maxSize: z.number().min(0).default(5 * 1024 * 1024), // 5MB default
  validation: z.object({
    minWidth: z.number().optional(),
    maxWidth: z.number().optional(),
    minHeight: z.number().optional(),
    maxHeight: z.number().optional(),
    aspectRatio: z.number().optional(),
  }).optional().default({}),
});

export type ImageConfig = z.infer<typeof imageConfigSchema>;

// Value validation schema generator
export class ImageComponentSchema extends BaseComponentSchema<z.ZodString, ImageConfig> {
  constructor(propertyName: string) {
    // Create a base schema that accepts both URLs and data URLs
    const baseSchema = z.string()
      .url('Must be a valid URL')
      .or(z.string().regex(/^data:image\/[a-z]+;base64,/, 'Must be a valid image data URL'));
    
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

export const imageInputSchema = z.object({
  name: z.string(),
  size: z.number(),
  type: z.string(),
  url: z.string(),
  width: z.number(),
  height: z.number(),
  source: z.enum(['upload', 'camera']).default('upload')
}).optional();

export const imageOutputSchema = z.object({
  name: z.string(),
  size: z.number(),
  type: z.string(),
  url: z.string(),
  width: z.number(),
  height: z.number(),
  source: z.enum(['upload', 'camera']).default('upload')
}); 