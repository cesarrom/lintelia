import { injectable, inject } from 'tsyringe';
import formData from 'form-data';
import Mailgun from 'mailgun.js';
import { env } from '../constants';
import { type IMailgunClient } from 'mailgun.js/Interfaces';
import { EmailTemplatesService } from './email-templates.service';
import { type EmailTemplate } from '../entities/tenant/email-template.entity';
import { TENANT_TOKEN } from '../injector/tokens';
import { Tenant } from '../entities/global/tenant.entity';

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  cc?: string[];
}

export interface SendTemplateOptions {
  to: string;
  subject: string;
  template: string;
  cc?: string[];
}

@injectable()
export class EmailsService {
  private mailgun: Mailgun;
  private domain: string;
  private client: IMailgunClient;

  constructor(
    @inject(EmailTemplatesService) private emailTemplatesService: EmailTemplatesService,
    @inject(TENANT_TOKEN) private tenant: Tenant
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
    const { template } = options;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email from ${this.tenant.name}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              margin: 0;
              padding: 0;
              background-color: ${this.tenant.pallette.secondary};
              color: #333333;
            }
            .container {
              max-width: 600px;
              margin: 20px auto;
              padding: 0;
              background: #ffffff;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              padding: 24px 0;
              background: ${this.tenant.pallette.primary};
              border-radius: 8px 8px 0 0;
            }
            .header img {
              max-height: 60px;
            }
            main {
              padding: 32px;
              color: #333333;
            }
            main a {
              color: ${this.tenant.pallette.accent};
              text-decoration: none;
            }
            main a:hover {
              text-decoration: underline;
            }
            .footer {
              text-align: center;
              padding: 20px;
              font-size: 12px;
              color: #666666;
              border-top: 1px solid ${this.tenant.pallette.secondary};
              background: #f8f8f8;
              border-radius: 0 0 8px 8px;
            }
            .button {
              display: inline-block;
              padding: 12px 24px;
              background: ${this.tenant.pallette.accent};
              color: #ffffff;
              text-decoration: none;
              border-radius: 4px;
              margin: 16px 0;
            }
            .button:hover {
              background: ${this.tenant.pallette.primary};
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="${this.tenant.logoUrl}" alt="${this.tenant.name} Logo">
            </div>
            <main>
              ${template}
            </main>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} ${this.tenant.name}. All rights reserved.</p>
              <p style="color: ${this.tenant.pallette.primary}">This is an automated message, please do not reply.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Replace variables in subject and body

    return this.sendEmail({
      to: options.to,
      subject: options.subject,
      text: template,
      html: html,
      cc: options.cc,
    });
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
