import { z } from 'zod';

export const VerificationTypeSchema = z.enum(['selfie', 'video', 'gesture', 'voice']);
export type VerificationType = z.infer<typeof VerificationTypeSchema>;

export const VerificationStepSchema = z.object({
  type: VerificationTypeSchema,
  instructions: z.string().optional(),
  timeLimit: z.number().optional(), // in seconds
  requiredGestures: z.array(z.string()).optional(),
  requiredPhrase: z.string().optional(),
});

export type VerificationStep = z.infer<typeof VerificationStepSchema>;

export const ProofOfLifeNodeDataSchema = z.object({
  verificationSteps: z.array(VerificationStepSchema),
  minConfidenceScore: z.number().min(0).max(1).optional(), // 0-1
  maxAttempts: z.number().optional(),
  timeoutDuration: z.number().optional(), // in seconds
  attempt: z.number().optional(),
  requireLocation: z.boolean().optional(),
  requireDeviceInfo: z.boolean().optional(),
});

export type ProofOfLifeNodeData = z.infer<typeof ProofOfLifeNodeDataSchema>;

export const events = {
  publicUrl: 'public_url',
  success: 'verified',
  failure: 'failure',
  reAttemptUrl: 're_attempt_url'
};