import { eq } from "drizzle-orm";
import { PlatformDB, applications } from "../models/platform.sql";

export class ApplicationsService {
  constructor(private readonly db: PlatformDB) { }

  async createApplication(applicationData: typeof applications.$inferInsert) {
    return await this.db.insert(applications).values(applicationData).returning();
  }

  async getApplicationById(id: number) {
    return await this.db
      .select()
      .from(applications)
      .where(eq(applications.id, id))
      .limit(1)
      .then((res) => res[0] || null);
  }

  async updateApplication(id: number, applicationData: Partial<typeof applications.$inferInsert>) {
    return await this.db
      .update(applications)
      .set(applicationData)
      .where(eq(applications.id, id))
      .returning();
  }

  async deleteApplication(id: number) {
    return await this.db.delete(applications).where(eq(applications.id, id)).returning();
  }

  async getAllApplications() {
    return await this.db.select().from(applications);
  }


}