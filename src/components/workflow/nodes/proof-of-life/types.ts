export type VerificationType = 'selfie' | 'video' | 'gesture' | 'voice';

export interface VerificationStep {
  type: VerificationType;
  instructions?: string;
  timeLimit?: number; // in seconds
  requiredGestures?: string[];
  requiredPhrase?: string;
}

export interface ProofOfLifeNodeData {
  name: string;
  description?: string;
  config: {
    verificationSteps: VerificationStep[];
    minConfidenceScore?: number; // 0-1
    maxAttempts?: number;
    timeoutDuration?: number; // in seconds
    requireLocation?: boolean;
    requireDeviceInfo?: boolean;
  };
} 