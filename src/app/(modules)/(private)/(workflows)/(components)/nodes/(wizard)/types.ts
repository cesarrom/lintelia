import { z } from 'zod';

export const WizardNodeDataSchema = z.object({
  urls: z.array(z.string())
});

export type WizardNodeData = z.infer<typeof WizardNodeDataSchema>;

export const events = {
  publicUrl: 'publicUrl',
  nextStep: 'nextStep',
  end: 'end'
};