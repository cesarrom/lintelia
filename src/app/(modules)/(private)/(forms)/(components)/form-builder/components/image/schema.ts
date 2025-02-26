import { z } from 'zod';
import { baseComponentConfigSchema } from '../../schemas';

export const imageConfigSchema = baseComponentConfigSchema.extend({
  placeholder: z.string().optional().default('Click or drag image here'),
  description: z.string().optional().default('Upload an image'),
  accept: z.string().default('image/*'),
  maxSize: z.number().min(1).default(5 * 1024 * 1024), // 5MB
  minSize: z.number().min(0).default(0),
  maxWidth: z.number().min(1).optional(),
  maxHeight: z.number().min(1).optional(),
  minWidth: z.number().min(1).optional(),
  minHeight: z.number().min(1).optional(),
  aspectRatio: z.number().optional(),
  previewSize: z.number().min(50).default(200),
  allowCamera: z.boolean().default(false),
  cameraOptions: z.object({
    facingMode: z.enum(['user', 'environment']).default('environment'),
    idealResolution: z.object({
      width: z.number().min(1).default(1280),
      height: z.number().min(1).default(720)
    }).default({ width: 1280, height: 720 })
  }).default({
    facingMode: 'environment',
    idealResolution: { width: 1280, height: 720 }
  })
});

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