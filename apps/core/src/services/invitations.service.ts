import { EmailsService } from './emails.service';
import { TenantsService } from './tenants.service';
import { sysInvitations } from '../entities/tenants';
import { LogsService } from './logs.service';
import { v4 as uuid } from 'uuid';
import assert from 'assert';
import { AbstractService } from './service';
import { eq } from 'drizzle-orm';
import { Invitation } from '@repo/fintivio/schemas';
import { env } from '../constants';
import { TENANT_CONNECTION } from '../injector/tokens/tenant-connection.token';
import { type TenantDatabase } from '../clients/database.client';
import { Injectable, Inject, Scope } from "@nestjs/common";

@Injectable({
  scope: Scope.REQUEST
})
export class InvitationsService extends AbstractService {
  constructor(
    @Inject(TENANT_CONNECTION) private db: TenantDatabase,
    @Inject(EmailsService) private emailsService: EmailsService,
    @Inject(TenantsService) private tenantsService: TenantsService,
    @Inject(LogsService) private logs: LogsService
  ) {
    super();
  }

  async createInvitation(email: string, role: string, domain: string): Promise<Invitation> {
    try {
      const tenant = await this.tenantsService.getByDomain(domain);
      assert(tenant, 'Tenant not found');

      const invitation = {
        id: uuid(),
        email,
        roleId: role
      };

      const [savedInvitation] = await this.db.insert(sysInvitations).values(invitation).returning().execute();

      const htmlMessage = `
        <html>
          <body>
            <p>Dear User,</p>
            
            <p>You have been invited to join ${tenant.name}.</p>
            
            <p>Please <a href="http${env.NODE_ENV === 'local' ? '' : 's'}://${tenant.domain}.${env.NODE_ENV === 'main' ? '' : env.NODE_ENV + '.'}fintivio.org/sign-on">click here to create your account</a>.</p>
            
            <p>If you did not expect this invitation, please ignore this email.</p>
            
            <p>Best regards,<br>${tenant.name} Team</p>
          </body>
        </html>
        `;

      await this.emailsService.sendEmail({
        to: email,
        subject: `Invitation to join ${tenant.name}`,
        text: '',
        html: htmlMessage
      });

      await this.logs.info('User invitation created', {
        category: 'security',
        source: 'InvitationsService',
        metadata: {
          invitationId: savedInvitation.id,
          email,
          role,
          tenant: domain
        }
      });

      return savedInvitation;
    } catch (error) {
      await this.logs.error('Failed to create user invitation', {
        category: 'security',
        source: 'InvitationsService',
        metadata: {
          email,
          role,
          tenant: domain,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  }

  async inviteApplicant(email: string, formName: string, applicationId: number, domain: string): Promise<Invitation> {
    try {
      const tenant = await this.tenantsService.getByDomain(domain);
      assert(tenant, 'Tenant not found');

      const invitation = {
        id: uuid(),
        email,
        roleId: formName,
        applicationId,
        tenantId: tenant.id
      };

      const [savedInvitation] = await this.db.insert(sysInvitations).values(invitation).returning().execute();

      const htmlMessage = `
        <html>
          <body>
            <p>Dear User,</p>
            
            <p>You have been invited to apply to our platform.</p>
            
            <p>Please <a href="http${env.NODE_ENV === 'local' ? '' : 's'}://${tenant.domain}.${env.NODE_ENV === 'main' ? '' : env.NODE_ENV + '.'}fintivio.org/sign-on">click here to create your account</a>.</p>
            
            <p>If you did not expect this invitation, please ignore this email.</p>
            
            <p>Best regards,<br>${tenant.name} Team</p>
          </body>
        </html>
        `;

      await this.emailsService.sendEmail({
        to: email,
        subject: `Invitation to apply to ${tenant.name}`,
        text: '',
        html: htmlMessage
      });

      await this.logs.info('Applicant invitation created', {
        category: 'form',
        source: 'InvitationsService',
        metadata: {
          invitationId: savedInvitation.id,
          email,
          formName,
          applicationId,
          tenant: domain
        }
      });

      return savedInvitation;
    } catch (error) {
      await this.logs.error('Failed to create applicant invitation', {
        category: 'form',
        source: 'InvitationsService',
        metadata: {
          email,
          formName,
          applicationId,
          tenant: domain,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  }

  async getInvitationByEmail(email: string): Promise<Invitation | null> {
    const [invitation] = await this.db.select().from(sysInvitations).where(eq(sysInvitations.email, email)).limit(1).execute();

    if (invitation) {
      await this.logs.info('Invitation retrieved', {
        category: 'security',
        source: 'InvitationsService',
        metadata: {
          invitationId: invitation.id,
          email
        }
      });
    }

    return invitation;
  }
}
