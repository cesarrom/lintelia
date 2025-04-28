import { inject, injectable } from "tsyringe";
import { DataSource, Repository } from "typeorm";
import { TENANT_DB_TOKEN } from "../injector/tokens";
import { SystemVariable, SystemVariableType } from "../entities/tenant/system-variable.entity";
import { LogsService } from "./logs.service";

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
    @inject(LogsService) private logs: LogsService
  ) {
    this.repository = this.conn.getRepository(SystemVariable);
  }

  async create(data: CreateSystemVariableInput): Promise<SystemVariable> {
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

      const variable = this.repository.create(data);
      const savedVariable = await this.repository.save(variable);

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
    try {
      const variable = await this.repository.findOneBy({ id });
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
      const savedVariable = await this.repository.save(variable);

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
    try {
      const variable = await this.repository.findOneBy({ id });
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

      const result = await this.repository.delete({ id });
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
    try {
      const variable = await this.repository.findOneBy({ id });
      
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
    try {
      const variable = await this.repository.findOneBy({ name });
      
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
    try {
      const variables = await this.repository.find({
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