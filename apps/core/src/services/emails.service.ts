import { LogsService } from './logs.service';
import { AbstractService } from './service';
import assert from 'assert';
import { Injectable, Inject, Scope } from "@nestjs/common";
import { TENANT } from '../injector/tokens/tenant.token';
import type { Tenant, SendEmailRequest, SendTemplateRequest } from '@repo/lintelia/schemas';
import { EMAIL_PROVIDER, type EmailProvider } from '../providers/email.provider';

@Injectable({
  scope: Scope.REQUEST
})
export class EmailsService extends AbstractService {
  constructor(
    @Inject(TENANT) private tenantValueService: Tenant,
    @Inject(LogsService) private logs: LogsService,
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
  ) {
    super();
  }

  async sendEmail(options: SendEmailRequest) {
    try {
      await this.logs.info('Sending email', {
        category: 'integration',
        source: 'EmailsService',
        metadata: {
          to: options.to,
          subject: options.subject,
          cc: options.cc,
          tenant: this.tenantValueService.domain,
        }
      });

      const response = await this.provider.send({
        tenant: this.tenantValueService?.domain,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        cc: options.cc,
      });

      await this.logs.info('Email sent successfully', {
        category: 'integration',
        source: 'EmailsService',
        metadata: {
          messageId: response.id,
          to: options.to,
          subject: options.subject,
          tenant: this.tenantValueService.domain,
        }
      });

      return response;
    } catch (error) {
      await this.logs.error('Failed to send email', {
        category: 'integration',
        source: 'EmailsService',
        metadata: {
          to: options.to,
          subject: options.subject,
          tenant: this.tenantValueService.domain,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw new Error('Failed to send email');
    }
  }

  async sendEmailTemplate(options: SendTemplateRequest) {
    const tenant = this.tenantValueService;
    assert(tenant, 'Tenant not found');
    try {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Email from ${tenant.name}</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                margin: 0;
                padding: 0;
                background-color: ${tenant.pallette.secondary};
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
                background: ${tenant.pallette.primary};
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
                color: ${tenant.pallette.accent};
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
                border-top: 1px solid ${tenant.pallette.secondary};
                background: #f8f8f8;
                border-radius: 0 0 8px 8px;
              }
              .button {
                display: inline-block;
                padding: 12px 24px;
                background: ${tenant.pallette.accent};
                color: #ffffff;
                text-decoration: none;
                border-radius: 4px;
                margin: 16px 0;
              }
              .button:hover {
                background: ${tenant.pallette.primary};
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <img src="${tenant.logoUrl}" alt="${tenant.name} Logo">
              </div>
              <main>
                ${options.template}
              </main>
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} ${tenant.name}. All rights reserved.</p>
                <p style="color: ${tenant.pallette.primary}">This is an automated message, please do not reply.</p>
              </div>
            </div>
          </body>
        </html>
      `;

      await this.logs.info('Sending templated email', {
        category: 'integration',
        source: 'EmailsService',
        metadata: {
          to: options.to,
          subject: options.subject,
          cc: options.cc,
          tenant: tenant.domain
        }
      });

      const result = await this.sendEmail({
        to: options.to,
        subject: options.subject,
        text: options.template,
        html: html,
        cc: options.cc,
      });

      await this.logs.info('Templated email sent successfully', {
        category: 'integration',
        source: 'EmailsService',
        metadata: {
          messageId: result.id,
          to: options.to,
          subject: options.subject,
          tenant: tenant.domain
        }
      });

      return result;
    } catch (error) {
      await this.logs.error('Failed to send templated email', {
        category: 'integration',
        source: 'EmailsService',
        metadata: {
          to: options.to,
          subject: options.subject,
          tenant: tenant.domain,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  }

  async sendApplicationConfirmation(to: string, applicationId: number) {
    const tenant = this.tenantValueService;
    assert(tenant, 'Tenant not found');
    try {
      await this.logs.info('Sending application confirmation email', {
        category: 'form',
        source: 'EmailsService',
        metadata: {
          to,
          applicationId,
          tenant: tenant.domain
        }
      });

      const result = await this.sendEmail({
        to,
        subject: 'Application Confirmation',
        text: `Your application with ID ${applicationId} has been received and is being processed.`,
        html: `<p>Your application with ID <strong>${applicationId}</strong> has been received and is being processed.</p>`,
      });

      await this.logs.info('Application confirmation email sent successfully', {
        category: 'form',
        source: 'EmailsService',
        metadata: {
          messageId: result.id,
          to,
          applicationId,
          tenant: tenant.domain
        }
      });

      return result;
    } catch (error) {
      await this.logs.error('Failed to send application confirmation email', {
        category: 'form',
        source: 'EmailsService',
        metadata: {
          to,
          applicationId,
          tenant: tenant.domain,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  }

  async sendVerificationResult(to: string, applicationId: number, status: string) {
    const tenant = this.tenantValueService;
    assert(tenant, 'Tenant not found');
    try {
      await this.logs.info('Sending verification result email', {
        category: 'form',
        source: 'EmailsService',
        metadata: {
          to,
          applicationId,
          status,
          tenant: tenant.domain
        }
      });

      const result = await this.sendEmail({
        to,
        subject: 'Application Verification Result',
        text: `The verification process for your application with ID ${applicationId} has been completed. Status: ${status}`,
        html: `<p>The verification process for your application with ID <strong>${applicationId}</strong> has been completed.</p><p>Status: <strong>${status}</strong></p>`,
      });

      await this.logs.info('Verification result email sent successfully', {
        category: 'form',
        source: 'EmailsService',
        metadata: {
          messageId: result.id,
          to,
          applicationId,
          status,
          tenant: tenant.domain
        }
      });

      return result;
    } catch (error) {
      await this.logs.error('Failed to send verification result email', {
        category: 'form',
        source: 'EmailsService',
        metadata: {
          to,
          applicationId,
          status,
          tenant: tenant.domain,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  }
}
