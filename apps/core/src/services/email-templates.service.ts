import { sysEmailTemplates } from "../entities/tenants";
import type { CreateEmailTemplateRequest, UpdateEmailTemplateRequest, EmailTemplate } from "@repo/fintivio/schemas";
import { LogsService } from './logs.service';
import { v4 as uuid } from 'uuid';
import { AbstractService } from './service';
import { eq } from 'drizzle-orm';
import { Injectable, Inject, Scope } from "@nestjs/common";
import { TENANT_CONNECTION } from "../injector/tokens/tenant-connection.token";
import { type TenantDatabase } from "../clients/database.client";
import { EmailEvents } from "@repo/fintivio/utilities";

@Injectable({
  scope: Scope.REQUEST
})
export class EmailTemplatesService extends AbstractService {
  constructor(
    @Inject(TENANT_CONNECTION) private db: TenantDatabase,
    @Inject(LogsService) private logs: LogsService
  ) {
    super();
  }

  async create(data: CreateEmailTemplateRequest): Promise<EmailTemplate> {
    try {
      const template = {
        id: uuid(),
        name: data.name,
        description: data.description || '',
        subject: data.subject,
        body: data.body,
        variables: data.variables,
        createdBy: data.createdBy
      } as EmailTemplate;

      const [savedTemplate] = await this.db.insert(sysEmailTemplates).values(template).returning().execute();
      await this.logs.justInsert(EmailEvents.TemplateCreated.log(savedTemplate));

      return savedTemplate;
    } catch (error) {
      await this.logs.error('Failed to create email template', {
        category: 'integration',
        source: 'EmailTemplatesService',
        userId: data.createdBy,
        metadata: {
          templateName: data.name,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  }

  async update(id: string, data: UpdateEmailTemplateRequest): Promise<EmailTemplate> {
    const [template] = await this.db.select().from(sysEmailTemplates).where(eq(sysEmailTemplates.id, id)).execute();

    if (!template) {
      await this.logs.warning('Email template update attempted on non-existent template', {
        category: 'integration',
        source: 'EmailTemplatesService',
        metadata: { templateId: id }
      });
      throw new Error("Email template not found");
    }

    try {
      if (data.name !== undefined) template.name = data.name;
      if (data.description !== undefined) template.description = data.description;
      if (data.subject !== undefined) template.subject = data.subject;
      if (data.body !== undefined) template.body = data.body;
      if (data.variables !== undefined) template.variables = data.variables;

      const [updatedTemplate] = await this.db.update(sysEmailTemplates).set(template).where(eq(sysEmailTemplates.id, id)).returning().execute();

      await this.logs.info('Email template updated', {
        category: 'integration',
        source: 'EmailTemplatesService',
        metadata: {
          templateId: id,
          templateName: template.name,
          updatedFields: Object.keys(data)
        }
      });

      return updatedTemplate;
    } catch (error) {
      await this.logs.error('Failed to update email template', {
        category: 'integration',
        source: 'EmailTemplatesService',
        metadata: {
          templateId: id,
          templateName: template.name,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  }

  async delete(id: string): Promise<EmailTemplate> {
    const [template] = await this.db.select().from(sysEmailTemplates).where(eq(sysEmailTemplates.id, id)).execute();

    if (!template) {
      await this.logs.warning('Email template deletion attempted on non-existent template', {
        category: 'integration',
        source: 'EmailTemplatesService',
        metadata: { templateId: id }
      });
      throw new Error("Email template not found");
    }

    try {
      await this.db.delete(sysEmailTemplates).where(eq(sysEmailTemplates.id, id)).execute();

      await this.logs.info('Email template deleted', {
        category: 'integration',
        source: 'EmailTemplatesService',
        metadata: {
          templateId: id,
          templateName: template.name
        }
      });

      return template;
    } catch (error) {
      await this.logs.error('Failed to delete email template', {
        category: 'integration',
        source: 'EmailTemplatesService',
        metadata: {
          templateId: id,
          templateName: template.name,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  }

  async getById(id: string): Promise<EmailTemplate | null> {
    const [template] = await this.db.select().from(sysEmailTemplates).where(eq(sysEmailTemplates.id, id)).execute();

    if (template) {
      await this.logs.debug('Email template retrieved', {
        category: 'integration',
        source: 'EmailTemplatesService',
        metadata: {
          templateId: id,
          templateName: template.name
        }
      });
    }

    return template;
  }

  async list(): Promise<EmailTemplate[]> {
    const templates = await this.db.select().from(sysEmailTemplates).execute();

    await this.logs.debug('Email templates listed', {
      category: 'integration',
      source: 'EmailTemplatesService',
      metadata: {
        count: templates.length
      }
    });

    return templates;
  }
}