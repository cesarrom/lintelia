import { Injectable } from 'ts-injection';
import formData from 'form-data';
import Mailgun from 'mailgun.js';
import { env } from '../constants';
import { type IMailgunClient } from 'mailgun.js/Interfaces';

@Injectable()
export class EmailsService {
  private mailgun: Mailgun;
  private domain: string;
  private client: IMailgunClient;

  constructor() {
    this.mailgun = new Mailgun(formData);
    this.client = this.mailgun.client({
      username: env.SMTP_USER,
      key: env.SMTP_PASS,
    });
    this.domain = env.SMTP_HOST;
  }

  async sendEmail(to: string, subject: string, text: string, html?: string, cc: string[] = []) {
    try {
      const response = await this.client.messages.create(this.domain, {
        from: env.EMAIL_FROM,
        to,
        subject,
        text,
        html,
        cc,
      });
      
      console.log('Message sent: %s', response.id);
      return response;
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send email');
    }
  }

  async sendApplicationConfirmation(to: string, applicationId: number) {
    const subject = 'Application Confirmation';
    const text = `Your application with ID ${applicationId} has been received and is being processed.`;
    const html = `<p>Your application with ID <strong>${applicationId}</strong> has been received and is being processed.</p>`;
    
    return this.sendEmail(to, subject, text, html);
  }

  async sendVerificationResult(to: string, applicationId: number, status: string) {
    const subject = 'Application Verification Result';
    const text = `The verification process for your application with ID ${applicationId} has been completed. Status: ${status}`;
    const html = `<p>The verification process for your application with ID <strong>${applicationId}</strong> has been completed.</p><p>Status: <strong>${status}</strong></p>`;
    
    return this.sendEmail(to, subject, text, html);
  }
}
