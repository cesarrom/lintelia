import { injectable, inject } from 'tsyringe';
import { EmailTemplate } from "../entities/tenant/email-template.entity";
import { DataSource, Repository } from "typeorm";
import { TENANT_DB_TOKEN } from "../injector/tokens";
import { v4 as uuid } from 'uuid';

@injectable()
export class EmailTemplatesService {
  private emailTemplateRepository: Repository<EmailTemplate>;

  constructor(
    @inject(TENANT_DB_TOKEN) private conn: DataSource
  ) {
    this.emailTemplateRepository = this.conn.getRepository(EmailTemplate);
  }

  async create(data: CreateEmailTemplateInput): Promise<EmailTemplate> {
    const template = new EmailTemplate();
    template.id = uuid();
    template.name = data.name;
    template.description = data.description || '';
    template.subject = data.subject;
    template.body = data.body;
    template.variables = data.variables;
    template.createdBy = data.createdBy;

    return await this.emailTemplateRepository.save(template);
  }

  async update(id: string, data: UpdateEmailTemplateInput): Promise<EmailTemplate> {
    const template = await this.emailTemplateRepository.findOne({
      where: { id }
    });

    if (!template) {
      throw new Error("Email template not found");
    }

    if (data.name !== undefined) template.name = data.name;
    if (data.description !== undefined) template.description = data.description;
    if (data.subject !== undefined) template.subject = data.subject;
    if (data.body !== undefined) template.body = data.body;
    if (data.variables !== undefined) template.variables = data.variables;

    return await this.emailTemplateRepository.save(template);
  }

  async delete(id: string): Promise<EmailTemplate> {
    const template = await this.emailTemplateRepository.findOne({
      where: { id }
    });

    if (!template) {
      throw new Error("Email template not found");
    }

    return await this.emailTemplateRepository.remove(template);
  }

  async getById(id: string): Promise<EmailTemplate | null> {
    const template = await this.emailTemplateRepository.findOne({
      where: { id }
    });

    if (!template) return null;
    return template;
  }

  async list(): Promise<EmailTemplate[]> {
    return await this.emailTemplateRepository.find();
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