import { eq } from "drizzle-orm";
import { emailTemplates } from "../models/platform.sql";
import { Injectable } from "ts-injection";
import type { PlatformDB } from "./tenants.service";
import { v4 as uuid } from 'uuid';

@Injectable()
export class EmailTemplatesService {
  constructor(private readonly db: PlatformDB) {}

  async create(data: CreateEmailTemplateInput) {
    const [template] = await this.db.insert(emailTemplates).values({
      id: uuid(),
      name: data.name,
      description: data.description || '',
      subject: data.subject,
      body: data.body,
      variables: JSON.stringify(data.variables),
      createdBy: data.createdBy,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }).returning();

    return {
      ...template,
      variables: JSON.parse(template.variables),
    };
  }

  async update(id: string, data: UpdateEmailTemplateInput) {
    const [template] = await this.db.update(emailTemplates)
      .set({
        name: data.name,
        description: data.description || '',
        subject: data.subject,
        body: data.body,
        variables: data.variables ? JSON.stringify(data.variables) : undefined,
        updatedAt: Date.now(),
      })
      .where(eq(emailTemplates.id, id))
      .returning();

    return {
      ...template,
      variables: JSON.parse(template.variables),
    };
  }

  async delete(id: string) {
    const [template] = await this.db.delete(emailTemplates).where(eq(emailTemplates.id, id)).returning();
    return template;
  }

  async getById(id: string) {
    const template = await this.db.select().from(emailTemplates).where(eq(emailTemplates.id, id)).limit(1).then(res => res[0]);
    if (!template) return null;

    return {
      ...template,
      variables: JSON.parse(template.variables),
    };
  }

  async list() {
    const templates = await this.db.select().from(emailTemplates);
    return templates.map(template => ({
      ...template,
      variables: JSON.parse(template.variables),
    }));
  }
}

export interface EmailTemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  description?: string;
  required?: boolean;
  defaultValue?: unknown;
}

export interface CreateEmailTemplateInput {
  name: string;
  description?: string;
  subject: string;
  body: string;
  variables: EmailTemplateVariable[];
  createdBy: string;
}

export interface UpdateEmailTemplateInput {
  name?: string;
  description?: string;
  subject?: string;
  body?: string;
  variables?: EmailTemplateVariable[];
} 