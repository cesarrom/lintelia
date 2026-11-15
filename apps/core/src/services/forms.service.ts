import { sysFormAnswers, sysFormInstances, sysForms } from "../entities/tenants";
import { v4 as uuid } from 'uuid';
import { LogsService } from './logs.service';
import { AbstractService } from "./service";
import { desc, eq, ilike, or } from "drizzle-orm";
import { WebService } from "./web.service";
import type { Form, FormAnswer, FormInstance, CreateFormInput, CreateFormAnswersInput, UpdateFormInput, CreateFormInstanceInput, UpdateFormInstanceInput } from "@repo/fintivio/schemas";
import { TENANT_CONNECTION } from "../injector/tokens/tenant-connection.token";
import { type TenantDatabase } from "../clients/database.client";
import { Injectable, Inject, Scope } from "@nestjs/common";

@Injectable({
  scope: Scope.REQUEST
})
export class FormsService extends AbstractService {

  constructor(
    @Inject(TENANT_CONNECTION) private db: TenantDatabase,
    @Inject(WebService) private webService: WebService,
    @Inject(LogsService) private logs: LogsService,
  ) {
    super();
  }

  async createFormWithAnswers(data: CreateFormInput, answers: CreateFormAnswersInput['answers']) {
    const user = await this.webService.getSessionUser();
    const form = await this.create(data);
    const instance = await this.createInstance({
      formId: form.id!,
      variables: {},
      submittedBy: user?.userId || 'system'
    });
    const answer = await this.createAnswers({
      instanceId: instance.id!,
      formId: form.id!,
      answers
    });

    return { form, instance, answer };
  }

  async create(data: CreateFormInput): Promise<Form> {
    const form = {
      id: uuid(),
      name: data.name,
      description: data.description || '',
      config: data.config,
      createdBy: data.createdBy,
      variables: (data.config?.variables || {}) as any,
    };

    await this.logs.info('Creating new form', {
      category: 'form',
      source: 'FormsService',
      userId: data.createdBy,
      metadata: {
        formId: form.id,
        formName: form.name
      }
    });

    const [savedForm] = await this.db.insert(sysForms).values(form).returning().execute();

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
    const user = await this.webService.getSessionUser();
    const formAnswer = {
      id: uuid(),
      formInstanceId: data.instanceId,
      fieldId: data.formId,
      value: data.answers,
      createdBy: user?.userId || 'system',
    };
    const [savedFormAnswer] = await this.db.insert(sysFormAnswers).values(formAnswer).returning().execute();
    return savedFormAnswer;
  }

  async update(id: string, data: UpdateFormInput): Promise<Form> {
    const [form] = await this.db.select().from(sysForms).where(eq(sysForms.id, id)).execute();

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

    const [updatedForm] = await this.db.update(sysForms).set(form).where(eq(sysForms.id, id)).returning().execute();

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
    const [form] = await this.db.select().from(sysForms).where(eq(sysForms.id, id)).execute();

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

    await this.db.delete(sysForms).where(eq(sysForms.id, id)).execute();

    await this.logs.info('Form deleted', {
      category: 'form',
      source: 'FormsService',
      metadata: {
        formId: id,
        formName: form.name
      }
    });

    return form;
  }

  async getById(id: string): Promise<Form | null> {
    const [form] = await this.db.select().from(sysForms).where(eq(sysForms.id, id)).execute();
    return form;
  }

  async list(search?: string): Promise<Form[]> {
    try {
      const forms = await this.db.select().from(sysForms).where(
        search
          ? or(ilike(sysForms.name, `%${search}%`), ilike(sysForms.description, `%${search}%`))
          : undefined
      )
      .orderBy(desc(sysForms.createdAt))
      .execute();

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
    const [form] = await this.db.select().from(sysForms).where(eq(sysForms.id, data.formId)).execute();

    if (!form) {
      await this.logs.error('Form not found for instance creation', {
        category: 'form',
        source: 'FormsService',
        userId: data.submittedBy,
        metadata: { formId: data.formId }
      });
      throw new Error("Form template not found");
    }

    const instance = {
      id: uuid(),
      formId: data.formId,
      variables: data.variables,
      answers: {},
      status: "draft" as const,
      submittedBy: data.submittedBy,
    };

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

    const [savedInstance] = await this.db.insert(sysFormInstances).values(instance).returning().execute();

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
    const [instance] = await this.db.select().from(sysFormInstances).where(eq(sysFormInstances.id, id)).execute();
    return instance;
  }

  async getAnswer(id: string): Promise<FormAnswer | null> {
    const [answer] = await this.db.select().from(sysFormAnswers).where(eq(sysFormAnswers.id, id)).execute();
    return answer;
  }

  async getAnswers(instanceId: string): Promise<FormAnswer[]> {
    const answers = await this.db.select().from(sysFormAnswers).where(eq(sysFormAnswers.formInstanceId, instanceId)).execute();
    return answers;
  }

  async updateInstance(id: string, data: UpdateFormInstanceInput): Promise<FormInstance> {
    const [instance] = await this.db.select().from(sysFormInstances).where(eq(sysFormInstances.id, id)).execute();

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

    const [updatedInstance] = await this.db.update(sysFormInstances).set(instance).where(eq(sysFormInstances.id, id)).returning().execute();

    await this.logs.info('Form instance updated', {
      category: 'form',
      source: 'FormsService',
      metadata: {
        instanceId: instance.id,
        formId: instance.formId,
        changes: data
      }
    });

    return updatedInstance;
  }

  async listInstances(formId: string): Promise<FormInstance[]> {
    try {
      const instances = await this.db.select().from(sysFormInstances).where(eq(sysFormInstances.formId, formId)).orderBy(desc(sysFormInstances.createdAt)).execute();

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