import { injectable, inject } from 'tsyringe';
import formData from 'form-data';
import Mailgun from 'mailgun.js';
import { env } from '../constants';
import { type IMailgunClient } from 'mailgun.js/Interfaces';
import { EmailTemplatesService } from './email-templates.service';
import { type EmailTemplate } from '../entities/tenant/email-template.entity';

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  cc?: string[];
}

export interface SendTemplateOptions {
  to: string;
  templateId: string;
  variables: Record<string, unknown>;
  cc?: string[];
}

@injectable()
export class EmailsService {
  private mailgun: Mailgun;
  private domain: string;
  private client: IMailgunClient;

  constructor(
    @inject(EmailTemplatesService) private emailTemplatesService: EmailTemplatesService
  ) {
    this.mailgun = new Mailgun(formData);
    this.client = this.mailgun.client({
      username: env.SMTP_USER,
      key: env.SMTP_PASS,
    });
    this.domain = env.SMTP_HOST;
  }

  async sendEmail(options: SendEmailOptions) {
    try {
      const response = await this.client.messages.create(this.domain, {
        from: env.EMAIL_FROM,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        cc: options.cc,
      });
      
      console.log('Message sent: %s', response.id);
      return response;
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send email');
    }
  }

  async sendEmailTemplate(options: SendTemplateOptions) {
    const template = await this.emailTemplatesService.getById(options.templateId);
    if (!template) {
      throw new Error('Email template not found');
    }

    // Validate required variables
    const missingVars = this.validateTemplateVariables(template, options.variables);
    if (missingVars.length > 0) {
      throw new Error(`Missing required variables: ${missingVars.join(', ')}`);
    }

    // Replace variables in subject and body
    const { subject, text } = this.interpolateTemplateVariables(template, options.variables);

    return this.sendEmail({
      to: options.to,
      subject,
      text,
      html: text,
      cc: options.cc,
    });
  }

  private validateTemplateVariables(template: EmailTemplate, variables: Record<string, unknown>): string[] {
    const missingVars: string[] = [];

    for (const [key, variable] of Object.entries(template.variables)) {
      if (variable.required && !(key in variables)) {
        missingVars.push(key);
      }
    }

    return missingVars;
  }

  private interpolateTemplateVariables(
    template: EmailTemplate,
    variables: Record<string, unknown>
  ): { subject: string; text: string } {
    let subject = template.subject;
    let text = template.body;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      const stringValue = this.formatVariableValue(value, template.variables[key]?.type);
      subject = subject.replace(regex, stringValue);
      text = text.replace(regex, stringValue);
    }

    return { subject, text };
  }

  private formatVariableValue(value: unknown, type?: string): string {
    if (value === null || value === undefined) {
      return '';
    }

    switch (type) {
      case 'date':
        return value instanceof Date 
          ? value.toLocaleDateString()
          : typeof value === 'string'
            ? new Date(value).toLocaleDateString()
            : String(value);
      case 'number':
        return typeof value === 'number'
          ? value.toString()
          : String(value);
      case 'boolean':
        return value ? 'Yes' : 'No';
      default:
        return String(value);
    }
  }

  async sendApplicationConfirmation(to: string, applicationId: number) {
    return this.sendEmail({
      to,
      subject: 'Application Confirmation',
      text: `Your application with ID ${applicationId} has been received and is being processed.`,
      html: `<p>Your application with ID <strong>${applicationId}</strong> has been received and is being processed.</p>`,
    });
  }

  async sendVerificationResult(to: string, applicationId: number, status: string) {
    return this.sendEmail({
      to,
      subject: 'Application Verification Result',
      text: `The verification process for your application with ID ${applicationId} has been completed. Status: ${status}`,
      html: `<p>The verification process for your application with ID <strong>${applicationId}</strong> has been completed.</p><p>Status: <strong>${status}</strong></p>`,
    });
  }
}
