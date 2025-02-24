import { injectable, inject } from 'tsyringe';
import { EmailsService } from './emails.service';
import { Resource } from 'sst';
import { TenantsService } from './tenants.service';
import { DataSource, Repository } from 'typeorm';
import { TENANT_DB_TOKEN } from '../injector/tokens';
import { Invitation } from '../entities/tenant/invitation.entity';
import { v4 as uuid } from 'uuid';
import assert from 'assert';

@injectable()
export class InvitationsService {
  private invitationRepository: Repository<Invitation>;

  constructor(
    @inject(EmailsService) private emailsService: EmailsService,
    @inject(TENANT_DB_TOKEN) private conn: DataSource,
    @inject(TenantsService) private tenantsService: TenantsService
  ) {
    this.invitationRepository = this.conn.getRepository(Invitation);
  }

  async createInvitation(email: string, role: string, domain: string): Promise<Invitation> {
    const tenant = await this.tenantsService.getByDomain(domain);

    assert(tenant, 'Tenant not found');

    const invitation = new Invitation();
    invitation.id = uuid();
    invitation.email = email;
    invitation.roleId = role;

    const savedInvitation = await this.invitationRepository.save(invitation);

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

    return savedInvitation;
  }

  async inviteApplicant(email: string, formName: string, applicationId: number, domain: string): Promise<Invitation> {
    const tenant = await this.tenantsService.getByDomain(domain);
    assert(tenant, 'Tenant not found');

    const invitation = new Invitation();
    invitation.id = uuid();
    invitation.email = email;
    invitation.roleId = formName;

    const savedInvitation = await this.invitationRepository.save(invitation);

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

    return savedInvitation;
  }

  async getInvitationByEmail(email: string): Promise<Invitation | null> {
    return await this.invitationRepository.findOne({
      where: { email },
    });
  }
}
