import { injectable, inject } from 'tsyringe';
import { EmailTemplate } from "../entities";
import { Repository } from "typeorm";
import { LogsService } from './logs.service';
import { v4 as uuid } from 'uuid';
import { TenantsService } from './tenants.service';
import { Service } from './service';

@injectable()
export class EmailTemplatesService extends Service {
  private emailTemplateRepository: Repository<EmailTemplate> | null = null;

  static dependencies() {
    return [
      TenantsService,
      LogsService
    ]
  }

  constructor(
    @inject(TenantsService) private tenantsService: TenantsService,
    @inject(LogsService) private logs: LogsService
  ) {
    super();
  }

  async getRepository() {
    if (this.emailTemplateRepository) {
      return this.emailTemplateRepository;
    }

    const conn = await this.tenantsService.getContextualPlatformDBClient();
    this.emailTemplateRepository = conn.getRepository(EmailTemplate);
    return this.emailTemplateRepository;
  }

  async create(data: CreateEmailTemplateInput): Promise<EmailTemplate> {
    const repository = await this.getRepository();
    try {
      const template = new EmailTemplate();
      template.id = uuid();
      template.name = data.name;
      template.description = data.description || '';
      template.subject = data.subject;
      template.body = data.body;
      template.variables = data.variables;
      template.createdBy = data.createdBy;

      const savedTemplate = await repository.save(template);

      await this.logs.info('Email template created', {
        category: 'integration',
        source: 'EmailTemplatesService',
        userId: data.createdBy,
        metadata: {
          templateId: savedTemplate.id,
          templateName: data.name,
          variableCount: Object.keys(data.variables).length
        }
      });

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

  async update(id: string, data: UpdateEmailTemplateInput): Promise<EmailTemplate> {
    const repository = await this.getRepository();
    const template = await repository.findOne({
      where: { id }
    });

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

      const updatedTemplate = await repository.save(template);

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
    const repository = await this.getRepository();
    const template = await repository.findOne({
      where: { id }
    });

    if (!template) {
      await this.logs.warning('Email template deletion attempted on non-existent template', {
        category: 'integration',
        source: 'EmailTemplatesService',
        metadata: { templateId: id }
      });
      throw new Error("Email template not found");
    }

    try {
      const deletedTemplate = await repository.remove(template);

      await this.logs.info('Email template deleted', {
        category: 'integration',
        source: 'EmailTemplatesService',
        metadata: {
          templateId: id,
          templateName: template.name
        }
      });

      return deletedTemplate;
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
    const repository = await this.getRepository();
    const template = await repository.findOne({
      where: { id }
    });

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
    const repository = await this.getRepository();
    const templates = await repository.find();

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
  variables: Record<string, EmailTemplateVariable>;
  createdBy: string;
}

export interface UpdateEmailTemplateInput {
  name?: string;
  description?: string;
  subject?: string;
  body?: string;
  variables?: Record<string, EmailTemplateVariable>;
}