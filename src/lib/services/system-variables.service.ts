import { inject, injectable } from "tsyringe";
import { DataSource, ObjectLiteral, Repository } from "typeorm";
import { SystemVariable, SystemVariableType } from "../entities";
import { LogsService } from "./logs.service";
import { Newable, Service } from "./service";
import { TenantsService } from "./tenants.service";

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
export class SystemVariablesService extends Service {
  private conn: DataSource | null = null;
  private repositories: Map<Newable<any>, Repository<any>> = new Map();

  static dependencies() {
    return [
      TenantsService,
      LogsService
    ]
  }

  constructor(
    @inject(TenantsService) private tenantsService: TenantsService,
    @inject(LogsService) private logs: LogsService
  ) { super(); }


  async getConnection(): Promise<DataSource> {
    if (this.conn) return this.conn;
    this.conn = await this.tenantsService.getContextualPlatformDBClient();
    return this.conn;
  }


  async getRepository<T extends ObjectLiteral>(cls: Newable<T>): Promise<Repository<T>> {
    if (this.repositories.has(cls)) {
      return this.repositories.get(cls)!;
    }
    const conn = await this.getConnection();
    const repository = conn.getRepository(cls);
    this.repositories.set(cls, repository);
    return repository! as any;
  }

  async create(data: CreateSystemVariableInput): Promise<SystemVariable> {
    const repository = await this.getRepository(SystemVariable);
    try {
      await this.logs.info('Creating system variable', {
        category: 'system',
        source: 'SystemVariablesService',
        metadata: {
          name: data.name,
          type: data.type,
          isProtected: data.isProtected
        }
      });

      // Validate value type matches declared type
      this.validateValue(data.type, data.value);

      const variable = repository.create(data);
      const savedVariable = await repository.save(variable);

      await this.logs.info('System variable created successfully', {
        category: 'system',
        source: 'SystemVariablesService',
        metadata: {
          variableId: savedVariable.id,
          name: savedVariable.name,
          type: savedVariable.type
        }
      });

      return savedVariable;
    } catch (error) {
      await this.logs.error('Failed to create system variable', {
        category: 'system',
        source: 'SystemVariablesService',
        metadata: {
          name: data.name,
          type: data.type,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  }

  async update(id: string, data: UpdateSystemVariableInput): Promise<SystemVariable> {
    const repository = await this.getRepository(SystemVariable);
    try {
      const variable = await repository.findOneBy({ id });
      if (!variable) {
        await this.logs.error('System variable not found for update', {
          category: 'system',
          source: 'SystemVariablesService',
          metadata: { variableId: id }
        });
        throw new Error('System variable not found');
      }

      await this.logs.info('Updating system variable', {
        category: 'system',
        source: 'SystemVariablesService',
        metadata: {
          variableId: id,
          name: variable.name,
          updatedFields: Object.keys(data)
        }
      });

      // If updating value, validate it matches the type
      if (data.value !== undefined) {
        this.validateValue(variable.type, data.value);
      }

      Object.assign(variable, data);
      const savedVariable = await repository.save(variable);

      await this.logs.info('System variable updated successfully', {
        category: 'system',
        source: 'SystemVariablesService',
        metadata: {
          variableId: savedVariable.id,
          name: savedVariable.name,
          updatedFields: Object.keys(data)
        }
      });

      return savedVariable;
    } catch (error) {
      await this.logs.error('Failed to update system variable', {
        category: 'system',
        source: 'SystemVariablesService',
        metadata: {
          variableId: id,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    const repository = await this.getRepository(SystemVariable);
    try {
      const variable = await repository.findOneBy({ id });
      if (!variable) {
        await this.logs.warning('System variable not found for deletion', {
          category: 'system',
          source: 'SystemVariablesService',
          metadata: { variableId: id }
        });
        return false;
      }

      await this.logs.warning('Deleting system variable', {
        category: 'system',
        source: 'SystemVariablesService',
        metadata: {
          variableId: id,
          name: variable.name,
          type: variable.type
        }
      });

      const result = await repository.delete({ id });
      const success = result.affected ? result.affected > 0 : false;

      if (success) {
        await this.logs.info('System variable deleted successfully', {
          category: 'system',
          source: 'SystemVariablesService',
          metadata: {
            variableId: id,
            name: variable.name
          }
        });
      }

      return success;
    } catch (error) {
      await this.logs.error('Failed to delete system variable', {
        category: 'system',
        source: 'SystemVariablesService',
        metadata: {
          variableId: id,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  }

  async getById(id: string): Promise<SystemVariable | null> {
    const repository = await this.getRepository(SystemVariable);
    try {
      const variable = await repository.findOneBy({ id });

      if (variable) {
        await this.logs.debug('System variable retrieved', {
          category: 'system',
          source: 'SystemVariablesService',
          metadata: {
            variableId: id,
            name: variable.name,
            type: variable.type
          }
        });
      } else {
        await this.logs.debug('System variable not found', {
          category: 'system',
          source: 'SystemVariablesService',
          metadata: { variableId: id }
        });
      }

      return variable;
    } catch (error) {
      await this.logs.error('Failed to retrieve system variable', {
        category: 'system',
        source: 'SystemVariablesService',
        metadata: {
          variableId: id,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      return null;
    }
  }

  async getByName(name: string): Promise<SystemVariable | null> {
    const repository = await this.getRepository(SystemVariable);
    try {
      const variable = await repository.findOneBy({ name });

      if (variable) {
        await this.logs.debug('System variable retrieved by name', {
          category: 'system',
          source: 'SystemVariablesService',
          metadata: {
            name,
            variableId: variable.id,
            type: variable.type
          }
        });
      } else {
        await this.logs.debug('System variable not found by name', {
          category: 'system',
          source: 'SystemVariablesService',
          metadata: { name }
        });
      }

      return variable;
    } catch (error) {
      await this.logs.error('Failed to retrieve system variable by name', {
        category: 'system',
        source: 'SystemVariablesService',
        metadata: {
          name,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      return null;
    }
  }

  async list(): Promise<SystemVariable[]> {
    const repository = await this.getRepository(SystemVariable);
    try {
      const variables = await repository.find({
        order: {
          name: 'ASC'
        }
      });

      await this.logs.debug('System variables listed', {
        category: 'system',
        source: 'SystemVariablesService',
        metadata: {
          count: variables.length
        }
      });

      return variables;
    } catch (error) {
      await this.logs.error('Failed to list system variables', {
        category: 'system',
        source: 'SystemVariablesService',
        metadata: {
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  }

  async asRecord() {
    const list = await this.list();

    return Object.fromEntries(list.map(v => [v.name, v.value]));
  }

  private validateValue(type: SystemVariableType, value: any) {
    try {
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
    } catch (error) {
      this.logs.error('System variable value validation failed', {
        category: 'system',
        source: 'SystemVariablesService',
        metadata: {
          type,
          value,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  }
} 