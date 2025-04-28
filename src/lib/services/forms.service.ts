import { injectable, inject } from "tsyringe";
import { Form } from "../entities";
import { FormInstance } from "../entities";
import { DataSource, ObjectLiteral, Repository } from "typeorm";
import { v4 as uuid } from 'uuid';
import { FormConfig } from "@/app/(modules)/(private)/(forms)/(components)/form-builder/schemas";
import { LogsService } from './logs.service';
import { FormAnswer } from "../entities";
import { TenantsService } from "./tenants.service";
import { Newable, Service } from "./service";
import { UsersService } from "./users.service";

@injectable()
export class FormsService extends Service {
  private conn: DataSource | null = null;
  private repositories: Map<Newable<any>, Repository<any>> = new Map();

  static dependencies() {
    return [
      UsersService,
      LogsService,
      TenantsService
    ]
  }

  constructor(
    @inject(UsersService) private usersService: UsersService,
    @inject(LogsService) private logs: LogsService,
    @inject(TenantsService) private tenantsService: TenantsService
  ) {
    super();
  }

  async getRepository<T extends ObjectLiteral>(cls: Newable<T>): Promise<Repository<T>> {
    if (this.repositories.has(cls)) {
      return this.repositories.get(cls)!;
    }
    const conn = this.conn || (await this.tenantsService.getContextualPlatformDBClient());
    const repository = conn.getRepository(cls);
    this.repositories.set(cls, repository);
    return repository!;
  }

  async createFormWithAnswers(data: CreateFormInput, answers: CreateFormAnswersInput['answers']) {
    const user = await this.usersService.getSessionUser();
    const form = await this.create(data);
    const instance = await this.createInstance({
      formId: form.id,
      variables: {},
      submittedBy: user?.userId || 'system'
    });
    const answer = await this.createAnswers({
      instanceId: instance.id,
      formId: form.id,
      answers
    });

    return { form, instance, answer };
  }

  async create(data: CreateFormInput): Promise<Form> {
    const formRepository = await this.getRepository(Form);
    const form = new Form();
    form.id = uuid();
    form.name = data.name;
    form.description = data.description || '';
    form.config = data.config;
    form.createdBy = data.createdBy;
    form.variables = (data.config?.variables || {}) as any;

    await this.logs.info('Creating new form', {
      category: 'form',
      source: 'FormsService',
      userId: data.createdBy,
      metadata: {
        formId: form.id,
        formName: form.name
      }
    });

    const savedForm = await formRepository.save(form);

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

  async createAnswers(data: CreateFormAnswersInput): Promise<FormAnswer> {
    const formAnswerRepository = await this.getRepository(FormAnswer);
    const user = await this.usersService.getSessionUser();
    const formAnswer = new FormAnswer();
    formAnswer.id = uuid();
    formAnswer.formInstanceId = data.instanceId;
    formAnswer.fieldId = data.formId;
    formAnswer.value = data.answers;
    formAnswer.createdBy = user?.userId || 'system';
    return await formAnswerRepository.save(formAnswer);
  }

  async update(id: string, data: UpdateFormInput): Promise<Form> {
    const formRepository = await this.getRepository(Form);
    const form = await formRepository.findOne({
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
    if (data.config?.variables !== undefined) form.variables = data.config!.variables as any;

    await this.logs.info('Updating form', {
      category: 'form',
      source: 'FormsService',
      metadata: {
        formId: form.id,
        formName: form.name,
        changes: data
      }
    });

    const updatedForm = await formRepository.save(form);

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
    const formRepository = await this.getRepository(Form);
    const form = await formRepository.findOne({
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

    const deletedForm = await formRepository.remove(form);

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
    const formRepository = await this.getRepository(Form);
    return await formRepository.findOne({
      where: { id },
    });
  }

  async list(search?: string): Promise<Form[]> {
    try {
      const formRepository = await this.getRepository(Form);
      const queryBuilder = formRepository.createQueryBuilder('form');

      if (search) {
        queryBuilder.where(
          'LOWER(form.name) LIKE LOWER(:search) OR LOWER(form.description) LIKE LOWER(:search)',
          { search: `%${search}%` }
        );
      }

      queryBuilder.orderBy('form.createdAt', 'DESC');

      const forms = await queryBuilder.getMany();

      await this.logs.info('Listed forms', {
        category: 'form',
        metadata: { search }
      });

      return forms;
    } catch (error) {
      await this.logs.error('Failed to list forms', {
        category: 'form',
        metadata: { search, error }
      });
      throw error;
    }
  }

  async createInstance(data: CreateFormInstanceInput): Promise<FormInstance> {
    const formRepository = await this.getRepository(Form);
    const formInstanceRepository = await this.getRepository(FormInstance);
    const form = await formRepository.findOne({
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

    const savedInstance = await formInstanceRepository.save(instance);

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
    const formInstanceRepository = await this.getRepository(FormInstance);
    return await formInstanceRepository.findOne({
      where: { id },
    });
  }

  async getAnswer(id: string): Promise<FormAnswer | null> {
    const formAnswerRepository = await this.getRepository(FormAnswer);
    return await formAnswerRepository.findOne({
      where: { id },
    });
  }

  async updateInstance(id: string, data: UpdateFormInstanceInput): Promise<FormInstance> {
    const formInstanceRepository = await this.getRepository(FormInstance);
    const instance = await formInstanceRepository.findOne({
      where: { id },
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

    return await formInstanceRepository.save(instance);
  }

  async listInstances(formId: string): Promise<FormInstance[]> {
    try {
      const formInstanceRepository = await this.getRepository(FormInstance);
      const instances = await formInstanceRepository.find({
        where: { formId },
        order: { createdAt: 'DESC' }
      });

      await this.logs.info('Listed form instances', {
        category: 'form',
        metadata: { formId }
      });

      return instances;
    } catch (error) {
      await this.logs.error('Failed to list form instances', {
        category: 'form',
        metadata: { formId, error }
      });
      throw error;
    }
  }
}

export interface CreateFormAnswersInput {
  formId: string;
  instanceId: string;
  answers: Record<string, any>;
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