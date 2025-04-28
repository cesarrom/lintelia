import { injectable, inject } from 'tsyringe';
import { EmailsService } from './emails.service';
import { Resource } from 'sst';
import { TenantsService } from './tenants.service';
import { Repository } from 'typeorm';
import { Invitation } from '../entities';
import { LogsService } from './logs.service';
import { v4 as uuid } from 'uuid';
import assert from 'assert';
import { Service } from './service';

@injectable()
export class InvitationsService extends Service {
  private invitationRepository: Repository<Invitation> | null = null;

  static dependencies() {
    return [
      EmailsService,
      TenantsService,
      LogsService
    ]
  }

  constructor(
    @inject(EmailsService) private emailsService: EmailsService,
    @inject(TenantsService) private tenantsService: TenantsService,
    @inject(LogsService) private logs: LogsService
  ) {
    super();
  }

  async getRepository() {
    if (this.invitationRepository) return this.invitationRepository;
    const conn = await this.tenantsService.getContextualPlatformDBClient();
    this.invitationRepository = conn.getRepository(Invitation);
    return this.invitationRepository;
  }

  async createInvitation(email: string, role: string, domain: string): Promise<Invitation> {
    const invitationRepository = await this.getRepository();
    assert(invitationRepository, 'Invitation repository not found');
    try {
      const tenant = await this.tenantsService.getByDomain(domain);
      assert(tenant, 'Tenant not found');

      const invitation = new Invitation();
      invitation.id = uuid();
      invitation.email = email;
      invitation.roleId = role;

      const savedInvitation = await invitationRepository.save(invitation);

      const htmlMessage = `
        <html>
          <body>
            <p>Dear User,</p>
            
            <p>You have been invited to join ${tenant.name}.</p>
            
            <p>Please <a href="http${Resource.App.stage === 'local' ? '' : 's'}://${tenant.domain}.${Resource.App.stage === 'main' ? '' : Resource.App.stage + '.'}fintivio.org/sign-on">click here to create your account</a>.</p>
            
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
    const invitationRepository = await this.getRepository();
    assert(invitationRepository, 'Invitation repository not found');
    try {
      const tenant = await this.tenantsService.getByDomain(domain);
      assert(tenant, 'Tenant not found');

      const invitation = new Invitation();
      invitation.id = uuid();
      invitation.email = email;
      invitation.roleId = formName;

      const savedInvitation = await invitationRepository.save(invitation);

      const htmlMessage = `
        <html>
          <body>
            <p>Dear User,</p>
            
            <p>You have been invited to apply to our platform.</p>
            
            <p>Please <a href="http${Resource.App.stage === 'local' ? '' : 's'}://${tenant.domain}.${Resource.App.stage === 'main' ? '' : Resource.App.stage + '.'}fintivio.org/sign-on">click here to create your account</a>.</p>
            
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
    const invitationRepository = await this.getRepository();
    assert(invitationRepository, 'Invitation repository not found');
    const invitation = await invitationRepository.findOne({
      where: { email },
    });

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
