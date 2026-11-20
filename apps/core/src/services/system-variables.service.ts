import { LogsService } from "./logs.service";
import { AbstractService } from "./service";
import { sysSystemVariables } from "../entities/tenants";
import { asc, eq } from "drizzle-orm";
import { CreateSystemVariableInput, SystemVariable, UpdateSystemVariableInput, ValueType, WorkflowValue } from "@repo/lintelia/schemas";
import { TENANT_CONNECTION } from "../injector/tokens/tenant-connection.token";
import { type TenantDatabase } from "../clients/database.client";
import { Injectable, Inject, Scope } from "@nestjs/common";


@Injectable({
  scope: Scope.REQUEST
})
export class SystemVariablesService extends AbstractService {

  constructor(
    @Inject(TENANT_CONNECTION) private db: TenantDatabase,
    @Inject(LogsService) private logs: LogsService
  ) { super(); }

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

      const variable = data as SystemVariable;
      const [savedVariable] = await this.db.insert(sysSystemVariables).values(variable).returning().execute();

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
      const [variable] = await this.db.select().from(sysSystemVariables).where(eq(sysSystemVariables.id, id)).limit(1).execute();
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
      const [savedVariable] = await this.db.update(sysSystemVariables).set(variable).where(eq(sysSystemVariables.id, id)).returning().execute();

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
      const [variable] = await this.db.select().from(sysSystemVariables).where(eq(sysSystemVariables.id, id)).limit(1).execute();
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

      const { length: affected } = await this.db.delete(sysSystemVariables).where(eq(sysSystemVariables.id, id)).returning().execute();
      const success = affected > 0;

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
      const [variable] = await this.db.select().from(sysSystemVariables).where(eq(sysSystemVariables.id, id)).limit(1).execute();

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
      const [variable] = await this.db.select().from(sysSystemVariables).where(eq(sysSystemVariables.name, name)).limit(1).execute();

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
      const variables = await this.db.select().from(sysSystemVariables).orderBy(asc(sysSystemVariables.name)).execute();

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

  private validateValue(type: ValueType, value: WorkflowValue) {
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