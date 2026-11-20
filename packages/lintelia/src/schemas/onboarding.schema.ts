import { z } from 'zod';

export const OnboardingDataSchema = z.object({
  name: z.string().max(255, 'Cannot exceed 255 characters').default(''),
  domain: z.string().regex(/^[a-z0-9-]+$/, 'May only contain numbers, lowercase letters, and dashes').max(255, 'Cannot exceed 255 characters').default(''),
  logoUrl: z.string().optional().default(''),
  logoName: z.string().optional().default(''),
  plan: z.string().max(255, 'Cannot exceed 255 characters').default(''),
  pallette: z.object({
    primary: z.string().max(255, 'Cannot exceed 255 characters').default('#000000'),
    secondary: z.string().max(255, 'Cannot exceed 255 characters').default('#000000'),
    accent: z.string().max(255, 'Cannot exceed 255 characters').default('#000000'),
  }).default({
    primary: '#000000',
    secondary: '#000000',
    accent: '#000000',
  }),
  invitee: z.array(z.object({
    email: z.string().email('Invalid email').max(255, 'Cannot exceed 255 characters').default(''),
    role: z.string().max(255, 'Cannot exceed 255 characters').default(''),
  })).default([]),
  allowedDomains: z.array(z.string().max(255, 'Cannot exceed 255 characters')).default([]),
  addressLine1: z.string().max(255, 'Cannot exceed 255 characters').default(''),
  addressLine2: z.string().max(255, 'Cannot exceed 255 characters').optional().default(''),
  city: z.string().max(255, 'Cannot exceed 255 characters').default(''),
  state: z.string().max(255, 'Cannot exceed 255 characters').default(''),
  country: z.string().max(255, 'Cannot exceed 255 characters').default(''),
  zipCode: z.string().max(255, 'Cannot exceed 255 characters').default(''),
  startWorkingHour: z.string().max(255, 'Cannot exceed 255 characters').default(''),
  endWorkingHour: z.string().max(255, 'Cannot exceed 255 characters').default(''),
  individualContract: z.string().default(''),
  coApplicantContract: z.string().default(''),
  businessContract: z.string().default(''),
  timezone: z.string().max(255, 'Cannot exceed 255 characters').default(''),
  currentEmail: z.string().optional().default(''),
  currentDomain: z.string().optional().default(''),
});

export type OnboardingData = z.infer<typeof OnboardingDataSchema>;