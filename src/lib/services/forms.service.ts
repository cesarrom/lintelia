import { injectable, inject } from "tsyringe";
import { Form } from "../entities/tenant/form.entity";
import { FormInstance } from "../entities/tenant/form-instance.entity";
import { DataSource, Repository } from "typeorm";
import { TENANT_DB_TOKEN } from "../injector/tokens";
import { v4 as uuid } from 'uuid';
import { FormConfig } from "@/app/(modules)/(private)/(forms)/(components)/form-builder/schemas";
import { LogsService } from './logs.service';

@injectable()
export class FormsService {
  private formRepository: Repository<Form>;
  private formInstanceRepository: Repository<FormInstance>;

  constructor(
    @inject(TENANT_DB_TOKEN) private conn: DataSource,
    @inject(LogsService) private logs: LogsService
  ) {
    this.formRepository = this.conn.getRepository(Form);
    this.formInstanceRepository = this.conn.getRepository(FormInstance);
  }

  async create(data: CreateFormInput): Promise<Form> {
    const form = new Form();
    form.id = uuid();
    form.name = data.name;
    form.description = data.description || '';
    form.config = data.config;
    form.createdBy = data.createdBy;

    await this.logs.info('Creating new form', {
      category: 'form',
      source: 'FormsService',
      userId: data.createdBy,
      metadata: {
        formId: form.id,
        formName: form.name
      }
    });

    const savedForm = await this.formRepository.save(form);

    await this.logs.info('Form created', {
      category: 'form',
      source: 'FormsService',
      userId: data.createdBy,
      metadata: {
        formId: savedForm.id,
        formName: data.name
      }
    });

    return savedForm;
  }

  async update(id: string, data: UpdateFormInput): Promise<Form> {
    const form = await this.formRepository.findOne({
      where: { id }
    });

    if (!form) {
      await this.logs.error('Form not found for update', {
        category: 'form',
        source: 'FormsService',
        metadata: { formId: id }
      });
      throw new Error("Form not found");
    }

    if (data.name !== undefined) form.name = data.name;
    if (data.description !== undefined) form.description = data.description;
    if (data.config !== undefined) form.config = data.config;

    await this.logs.info('Updating form', {
      category: 'form',
      source: 'FormsService',
      metadata: {
        formId: form.id,
        formName: form.name,
        changes: data
      }
    });

    const updatedForm = await this.formRepository.save(form);

    await this.logs.info('Form updated', {
      category: 'form',
      source: 'FormsService',
      metadata: {
        formId: id,
        formName: form.name,
        updatedFields: Object.keys(data)
      }
    });

    return updatedForm;
  }

  async delete(id: string): Promise<Form> {
    const form = await this.formRepository.findOne({
      where: { id }
    });

    if (!form) {
      await this.logs.error('Form not found for deletion', {
        category: 'form',
        source: 'FormsService',
        metadata: { formId: id }
      });
      throw new Error("Form not found");
    }

    await this.logs.warning('Deleting form', {
      category: 'form',
      source: 'FormsService',
      metadata: {
        formId: form.id,
        formName: form.name
      }
    });

    const deletedForm = await this.formRepository.remove(form);

    await this.logs.info('Form deleted', {
      category: 'form',
      source: 'FormsService',
      metadata: {
        formId: id,
        formName: form.name
      }
    });

    return deletedForm;
  }

  async getById(id: string): Promise<Form | null> {
    return await this.formRepository.findOne({
      where: { id },
      relations: ['creator']
    });
  }

  async list(): Promise<Form[]> {
    return await this.formRepository.find({ });
  }

  async createInstance(data: CreateFormInstanceInput): Promise<FormInstance> {
    const form = await this.formRepository.findOne({
      where: { id: data.formId }
    });

    if (!form) {
      await this.logs.error('Form not found for instance creation', {
        category: 'form',
        source: 'FormsService',
        userId: data.submittedBy,
        metadata: { formId: data.formId }
      });
      throw new Error("Form template not found");
    }

    const instance = new FormInstance();
    instance.id = uuid();
    instance.formId = data.formId;
    instance.form = form;
    instance.variables = data.variables;
    instance.answers = {};
    instance.status = "draft";
    instance.submittedBy = data.submittedBy;

    await this.logs.info('Creating form instance', {
      category: 'form',
      source: 'FormsService',
      userId: data.submittedBy,
      metadata: {
        formId: form.id,
        formName: form.name,
        instanceId: instance.id
      }
    });

    const savedInstance = await this.formInstanceRepository.save(instance);

    await this.logs.info('Form instance created', {
      category: 'form',
      source: 'FormsService',
      userId: data.submittedBy,
      metadata: {
        formId: data.formId,
        instanceId: savedInstance.id,
        formName: form.name
      }
    });

    return savedInstance;
  }

  async getInstance(id: string): Promise<FormInstance | null> {
    return await this.formInstanceRepository.findOne({
      where: { id },
      relations: ['form']
    });
  }

  async updateInstance(id: string, data: UpdateFormInstanceInput): Promise<FormInstance> {
    const instance = await this.formInstanceRepository.findOne({
      where: { id },
      relations: ['form']
    });

    if (!instance) {
      await this.logs.error('Form instance not found for update', {
        category: 'form',
        source: 'FormsService',
        metadata: { instanceId: id }
      });
      throw new Error("Form instance not found");
    }

    if (data.answers !== undefined) instance.answers = data.answers;
    if (data.status !== undefined) instance.status = data.status;
    if (data.variables !== undefined) instance.variables = data.variables;

    await this.logs.info('Updating form instance', {
      category: 'form',
      source: 'FormsService',
      metadata: {
        instanceId: instance.id,
        formId: instance.formId,
        changes: data
      }
    });

    return await this.formInstanceRepository.save(instance);
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

export interface CreateFormInstanceInput {
  formId: string;
  variables: Record<string, unknown>;
  submittedBy: string;
}

export interface UpdateFormInstanceInput {
  answers?: Record<string, any>;
  status?: "draft" | "submitted";
  variables?: Record<string, unknown>;
}