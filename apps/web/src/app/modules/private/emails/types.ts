export interface TemplateVariable {
  name: string; // e.g., "userName", "orderId"
}

export interface EmailTemplate {
  id: string;
  name: string; // User-friendly name for the template
  subject: string; // Default subject line, can include variables
  body: string; // Template body, can include variables like {{variableName}}
  variables: TemplateVariable[]; // Auto-detected variables
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export interface EmailRecipient {
  email: string;
  name?: string; // Optional recipient name
}

export interface SendEmailPayload {
  templateId: string;
  subject: string;
  recipients: EmailRecipient[];
  variableValues: Record<string, string>; // e.g., { userName: "John Doe", orderId: "123" }
}
