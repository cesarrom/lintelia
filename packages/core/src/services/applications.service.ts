import { eq } from "drizzle-orm";
import { applications } from "../models/platform.sql";
import { type PlatformDB } from "./tenants.service";
import { KYCService } from "./kyc.service";
import { env } from "../constants";
import { PLATFORM_DB_TOKEN } from "../libs/injector/tokens";
import { Autowire, Injectable } from "ts-injection";

@Injectable()
export class ApplicationsService {
  @Autowire(KYCService)
  private kycService: KYCService;
  @Autowire(PLATFORM_DB_TOKEN)
  private db: PlatformDB;

  async createApplication(applicationData: Omit<typeof applications.$inferInsert, 'data' | 'status'> & { data: any }) {
    const { id: applicantId } = await this.kycService.createApplicant({
      first_name: applicationData.data.firstName,
      last_name: applicationData.data.lastName,
      dob: applicationData.data.dob,
      address: {
        street: applicationData.data.addressLine1,
        building_number: applicationData.data.addressLine2,
        town: applicationData.data.city,
        postcode: applicationData.data.zipCode,
        country: applicationData.data.country,
      },
    });

    const { id: workflowRunId } = await this.kycService.createWorkflowRun({
      applicant_id: applicantId,
      workflow_id: env.ONFIDO_WORKFLOW_ID,
    });

    const data = {
      ...applicationData,
      data: JSON.stringify(applicationData.data) as string,
      verificationWorkflowRunId: workflowRunId,
      verificationApplicantId: applicantId,
      verificationStatus: 'pending',
      status: 'pending',
    };

    const [app] = await this.db.insert(applications).values(data).returning().execute();

    return app;
  }

  async getApplicationById(id: number) {
    return await this.db
      .select()
      .from(applications)
      .where(eq(applications.id, id))
      .limit(1)
      .execute()
      .then((res) => res[0] || null);
  }

  async getApplicationsByUserId(userId: string) {
    return await this.db
      .select()
      .from(applications)
      .where(eq(applications.userId, userId))
      .execute();
  }

  async updateApplication(id: number, applicationData: Partial<typeof applications.$inferInsert>) {
    return await this.db
      .update(applications)
      .set(applicationData)
      .where(eq(applications.id, id))
      .returning()
      .execute();
  }

  async deleteApplication(id: number) {
    return await this.db.delete(applications).where(eq(applications.id, id)).returning().execute();
  }

  async getAllApplications() {
    return await this.db.select().from(applications).execute();
  }


}