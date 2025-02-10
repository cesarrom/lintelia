import { eq } from "drizzle-orm";
import { forms } from "../models/platform.sql";
import { Autowire, Injectable } from "ts-injection";
import type { PlatformDB } from "./tenants.service";
import type { FormConfig } from "../types/form";
import { v4 as uuid } from 'uuid';
import { PLATFORM_DB_TOKEN } from "../injector/tokens";

@Injectable()
export class FormsService {
  @Autowire(PLATFORM_DB_TOKEN)
  private readonly db: PlatformDB;

  async create(data: CreateFormInput) {
    const [form] = await this.db.insert(forms).values({
      id: uuid(),
      name: data.name,
      description: data.description || '',
      config: JSON.stringify(data.config),
      createdBy: data.createdBy,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }).returning();

    return {
      ...form,
      config: JSON.parse(form.config),
    };
  }

  async update(id: string, data: UpdateFormInput) {
    const [form] = await this.db.update(forms)
      .set({
        name: data.name,
        description: data.description || '',
        config: data.config ? JSON.stringify(data.config) : undefined,
        updatedAt: Date.now(),
      })
      .where(eq(forms.id, id))
      .returning();

    return {
      ...form,
      config: JSON.parse(form.config),
    };
  }

  async delete(id: string) {
    const [form] = await this.db.delete(forms).where(eq(forms.id, id)).returning();
    return form;
  }

  async getById(id: string) {
    const form = await this.db.select().from(forms).where(eq(forms.id, id)).limit(1).then(res => res[0]);
    if (!form) return null;

    return {
      ...form,
      config: JSON.parse(form.config),
    };
  }

  async list() {
    const formList = await this.db.select().from(forms);
    return formList.map(form => ({
      ...form,
      config: JSON.parse(form.config),
    }));
  }
}

export interface CreateFormInput {
  name: string;
  description?: string;
  config: FormConfig;
  createdBy: string;
}

export interface UpdateFormInput {
  name?: string;
  description?: string;
  config?: FormConfig;
} 