import { inject, injectable } from "tsyringe";
import { DataSource, Repository } from "typeorm";
import { TENANT_DB_TOKEN } from "../injector/tokens";
import { SystemVariable, SystemVariableType } from "../entities/tenant/system-variable.entity";

export interface CreateSystemVariableInput {
  name: string;
  description: string;
  type: SystemVariableType;
  value: any;
  isProtected?: boolean;
}

export interface UpdateSystemVariableInput {
  name?: string;
  description?: string;
  value?: any;
  isProtected?: boolean;
}

@injectable()
export class SystemVariablesService {
  private repository: Repository<SystemVariable>;

  constructor(
    @inject(TENANT_DB_TOKEN) private conn: DataSource,
  ) {
    this.repository = this.conn.getRepository(SystemVariable);
  }

  async create(data: CreateSystemVariableInput): Promise<SystemVariable> {
    // Validate value type matches declared type
    this.validateValue(data.type, data.value);

    const variable = this.repository.create(data);
    return await this.repository.save(variable);
  }

  async update(id: string, data: UpdateSystemVariableInput): Promise<SystemVariable> {
    const variable = await this.repository.findOneBy({ id });
    if (!variable) {
      throw new Error('System variable not found');
    }

    // If updating value, validate it matches the type
    if (data.value !== undefined) {
      this.validateValue(variable.type, data.value);
    }

    Object.assign(variable, data);
    return await this.repository.save(variable);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete({ id });
    return result.affected ? result.affected > 0 : false;
  }

  async getById(id: string): Promise<SystemVariable | null> {
    return await this.repository.findOneBy({ id });
  }

  async getByName(name: string): Promise<SystemVariable | null> {
    return await this.repository.findOneBy({ name });
  }

  async list(): Promise<SystemVariable[]> {
    return await this.repository.find({
      order: {
        name: 'ASC'
      }
    });
  }

  private validateValue(type: SystemVariableType, value: any) {
    switch (type) {
      case 'string':
        if (typeof value !== 'string') {
          throw new Error('Value must be a string');
        }
        break;
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          throw new Error('Value must be a number');
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          throw new Error('Value must be a boolean');
        }
        break;
      case 'json':
        try {
          if (typeof value === 'string') {
            JSON.parse(value);
          } else {
            // Test if value can be stringified
            JSON.stringify(value);
          }
        } catch {
          throw new Error('Value must be valid JSON');
        }
        break;
      case 'array':
        if (!Array.isArray(value)) {
          throw new Error('Value must be an array');
        }
        break;
      default:
        throw new Error('Invalid type');
    }
  }
} 