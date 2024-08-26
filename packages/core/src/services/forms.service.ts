import { eq } from "drizzle-orm";
import { PlatformDB, forms } from "../models/platform.sql";

export class FormsService {
  constructor(private readonly db: PlatformDB) { }

  async createForm(formData: typeof forms.$inferInsert) {
    return await this.db.insert(forms).values(formData).returning();
  }

  async getFormById(id: number) {
    return await this.db
      .select()
      .from(forms)
      .where(eq(forms.id, id))
      .limit(1)
      .then((res) => res[0] || null);
  }

  async updateForm(id: number, formData: Partial<typeof forms.$inferInsert>) {
    return await this.db
      .update(forms)
      .set(formData)
      .where(eq(forms.id, id))
      .returning();
  }

  async deleteForm(id: number) {
    return await this.db.delete(forms).where(eq(forms.id, id)).returning();
  }

  async getAllForms() {
    return await this.db.select().from(forms);
  }

}