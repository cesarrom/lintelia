export interface WizardStep {
  id: string;
  name: string;
  description?: string;
  nodeId: string;
  // Optional configuration for the step
  config?: {
    skipCondition?: string; // Expression to evaluate if step should be skipped
    timeoutSeconds?: number; // Max time allowed for step completion
    retryCount?: number; // Number of retries allowed
  };
}

export interface WizardNodeData {
  // Array of steps in execution order
  steps: WizardStep[];
  // Optional settings
  settings?: {
    allowStepNavigation?: boolean; // Whether users can navigate between steps
    saveProgress?: boolean; // Whether to save progress between steps
    expiryHours?: number; // How long the wizard session remains valid
    theme?: 'default' | 'minimal' | 'custom'; // Visual theme for the wizard
    customCss?: string; // Custom CSS for styling
  };
}