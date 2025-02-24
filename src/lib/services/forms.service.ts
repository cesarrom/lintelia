import { injectable, inject } from "tsyringe";
import { Form } from "../entities/tenant/form.entity";
import { DataSource, Repository } from "typeorm";
import { TENANT_DB_TOKEN } from "../injector/tokens";
import { v4 as uuid } from 'uuid';
import { FormConfig } from "@/types/form";

@injectable()
export class FormsService {
  private formRepository: Repository<Form>;

  constructor(
    @inject(TENANT_DB_TOKEN) private conn: DataSource
  ) {
    this.formRepository = this.conn.getRepository(Form);
  }

  async create(data: CreateFormInput): Promise<Form> {
    const form = new Form();
    form.id = uuid();
    form.name = data.name;
    form.description = data.description || '';
    form.config = data.config;
    form.createdBy = data.createdBy;

    return await this.formRepository.save(form);
  }

  async update(id: string, data: UpdateFormInput): Promise<Form> {
    const form = await this.formRepository.findOne({
      where: { id }
    });

    if (!form) {
      throw new Error("Form not found");
    }

    if (data.name !== undefined) form.name = data.name;
    if (data.description !== undefined) form.description = data.description;
    if (data.config !== undefined) form.config = data.config;

    return await this.formRepository.save(form);
  }

  async delete(id: string): Promise<Form> {
    const form = await this.formRepository.findOne({
      where: { id }
    });

    if (!form) {
      throw new Error("Form not found");
    }

    return await this.formRepository.remove(form);
  }

  async getById(id: string): Promise<Form | null> {
    return await this.formRepository.findOne({
      where: { id },
      relations: ['creator']
    });
  }

  async list(): Promise<Form[]> {
    return await this.formRepository.find({
      relations: ['creator']
    });
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