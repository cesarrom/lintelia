import { and, desc, eq, inArray } from "drizzle-orm";
import { forms, formsValidationFeatures, validationFeatures } from "../models/platform.sql";
import { type PlatformDB } from "./tenants.service";
import { PLATFORM_DB_TOKEN, TENANTS_DB_TOKEN } from "../libs/injector/tokens";
import { Autowire, Injectable } from "ts-injection";
import { defaultForms, tenantsDB } from "../models/tenants.sql";

@Injectable()
export class FormsService {

  @Autowire(PLATFORM_DB_TOKEN)
  private db: PlatformDB

  @Autowire(TENANTS_DB_TOKEN)
  private tenantsDb: typeof tenantsDB;

  async createForm(formData: typeof forms.$inferInsert & { validationFeatures?: string[] }) {
    await this.disableAllFormsByPurpose(formData.purpose);
    const [form] = await this.db.insert(forms).values({ ...formData, status: 'active' }).returning();

    for (const validationFeature of formData.validationFeatures) {
      await this.addValidationFeaturesToForm(form.id, validationFeature);
    }

    return form;
  }

  async getFormById(id: number) {
    const [form] = await this.db
      .select()
      .from(forms)
      .where(
        eq(forms.id, id),
      )
      .orderBy(desc(forms.createdAt))
      .limit(1)
      .execute();

    return form;
  }

  async getPurposes(status?: string) {
    const purposes = await this.db
      .selectDistinct({ purpose: forms.purpose })
      .from(forms)
      .where(
        and(
          eq(forms.status, status || forms.status)
        )
      ).execute()

    return purposes.map(({ purpose }) => purpose);
  }

  async getFormByPurpose(purpose: string) {
    const [form] = await this.db
      .select()
      .from(forms)
      .where(
        and(
          eq(forms.purpose, purpose),
          eq(forms.status, 'active')
        )
      )
      .orderBy(desc(forms.createdAt))
      .limit(1)
      .execute();

    return form;
  }

  async disableAllFormsByPurpose(purpose: string) {
    return await this.db.update(forms)
      .set({ status: 'inactive' })
      .where(and(eq(forms.purpose, purpose), eq(forms.status, 'active')))
      .returning();
  }

  async updateForm(id: number, formData: Partial<typeof forms.$inferSelect & { validationFeatures: string[] }>) {
    await this.disableAllFormsByPurpose(formData.purpose);
    this.deleteValidationFeaturesFromForm(id);
    console.log('validationFeatures: ', formData.validationFeatures);
    for (const validationFeature of formData.validationFeatures) {
      await this.addValidationFeaturesToForm(id, validationFeature);
    }

    return await this.db
      .update(forms)
      .set({ ...formData, status: 'active' })
      .where(eq(forms.id, id))
      .returning();
  }

  async deleteValidationFeaturesFromForm(formId: number) {
    return this.db.delete(formsValidationFeatures).where(eq(formsValidationFeatures.formId, formId)).execute();
  }

  async addValidationFeaturesToForm(formId: number, validationFeature: string) {
    return this.db.insert(formsValidationFeatures).values({
      formId,
      featureId: validationFeature,
    }).returning();
  }

  async getValidationFeaturesFromForms(formIds: number[]) {
    return this.db.select().from(formsValidationFeatures).where(inArray(formsValidationFeatures.formId, formIds));
  }

  async listAvailableValidationFeatures() {
    return await this.db.select().from(validationFeatures);
  }

  async deleteForm(id: number) {
    return await this.db.delete(forms).where(eq(forms.id, id)).returning();
  }

  async getAllForms() {
    return await this.db.select().from(forms);
  }

  async setupInitialForms(userId: string) {
    const features = ['Identity Validation', 'Proof of Life', 'Link Persons'];

    await this.db.insert(validationFeatures).values(features.map(feature => ({
      id: feature,
      description: feature,
    }))).execute();

    const allDefaultForms = await this.tenantsDb.select().from(defaultForms).execute();

    return await this.db.insert(forms).values(allDefaultForms.map(f => ({
      userId,
      title: f.purpose,
      description: f.purpose,
      dmnKey: f.dmnKey,
      formKey: f.formKey,
      status: 'active',
      purpose: f.purpose,
    }))).returning().execute();
  }
}