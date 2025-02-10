import { Autowire, Injectable } from 'ts-injection'
import { EmailsService } from './emails.service'
import { Resource } from 'sst'
import { TenantsService, type PlatformDB } from './tenants.service';
import { eq } from 'drizzle-orm';
import { PLATFORM_DB_TOKEN } from '../injector/tokens';
import { invitations } from '../models/platform.sql';

export type Invitation = typeof invitations.$inferSelect;

@Injectable()
export class InvitationsService {
  @Autowire(EmailsService)
  private emailsService: EmailsService;

  @Autowire(PLATFORM_DB_TOKEN)
  private db: PlatformDB;

  @Autowire(TenantsService)
  private tenantsService: TenantsService;

  constructor() { }

  async createInvitation(email: string, role: string, domain: string): Promise<Invitation> {
    const tenant = await this.tenantsService.getByDomain(domain);

    const invitation = await this.db.insert(invitations).values({
      email,
      purpose: 'invitation',
      data: JSON.stringify({
        domain,
        role,
      }),
    } as any).returning().execute();

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

    await this.emailsService.sendEmail(
      email,
      `Invitation to join ${tenant.name}`,
      '',
      htmlMessage
    );

    return invitation[0];

  }

  async inviteApplicant(email: string, formName: string, applicationId: number, domain: string): Promise<Invitation> {
    const tenant = await this.tenantsService.getByDomain(domain);

    const [invitation] = await this.db.insert(invitations).values({
      email,
      purpose: 'co-applicant',
      data: JSON.stringify({
        role: formName,
        applicationId,
      }),
    }).returning().execute();

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

    await this.emailsService.sendEmail(
      email,
      `Invitation to apply to ${tenant.name}`,
      '',
      htmlMessage
    );


    return invitation;
  }

  async getInvitationByEmail(email: string): Promise<Invitation | null> {
    const invitation = await this.db
      .select()
      .from(invitations)
      .where(eq(invitations.email, email))
      .limit(1)
      .execute();

    return invitation[0] || null;
  }

}
