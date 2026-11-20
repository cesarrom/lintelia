import { z } from 'zod';
import { zodToJsonSchema } from "zod-to-json-schema";
import { jsonSchemaToZod } from "json-schema-to-zod";
import type { BaseConfig } from '@repo/lintelia/schemas';

export abstract class BaseComponentSchema<T extends z.ZodType, C extends BaseConfig = BaseConfig> {
  protected schema: T;
  protected propName: string;

  constructor(schema: T, propName: string) {
    this.schema = schema;
    this.propName = propName;
  }

  setRequired(required: boolean): this {
    if (!required && !this.schema.isOptional()) {
      this.schema = this.schema.optional() as unknown as T;
    } else if (required && this.schema.isOptional()) {
      // Remove optional from the schema
      // @ts-ignore - This is a hack but necessary for now
      this.schema = new (this.schema.unwrap().constructor)(this.schema.unwrap()._def) as T;
    }
    return this;
  }

  getSchema(): T {
    return this.schema;
  }

  toJSON() {
    return zodToJsonSchema(this.getSchema());
  }

  static fromJSON<T extends z.ZodType>(json: any, propName: string) {
    const Type = this as any;
    const zodSchema = jsonSchemaToZod(json);
    // Extract the inner schema for the property
    const innerSchema = (zodSchema as any)._def.shape();
    return new Type(innerSchema, propName);
  }

  /**
   * Creates a validation schema from a component configuration
   * This method should be implemented by each component to apply its specific validation rules
   * @param config The component configuration
   * @returns The component schema instance with validation rules applied
   */
  abstract fromConfig(config: C): this;
} 

export abstract class BaseLayoutSchema<T extends z.ZodType, C> {
  protected schema: T;

  constructor(schema: T) {
    this.schema = schema;
  }

  setRequired(required: boolean): this {
    if (!required && !this.schema.isOptional()) {
      this.schema = this.schema.optional() as unknown as T;
    } else if (required && this.schema.isOptional()) {
      // Remove optional from the schema
      // @ts-ignore - This is a hack but necessary for now
      this.schema = new (this.schema.unwrap().constructor)(this.schema.unwrap()._def) as T;
    }
    return this;
  }

  getSchema(): T {
    return this.schema;
  }

  toJSON() {
    return zodToJsonSchema(this.getSchema());
  }

  static fromJSON<T extends z.ZodType>(json: any, propName: string) {
    const Type = this as any;
    const zodSchema = jsonSchemaToZod(json);
    // Extract the inner schema for the property
    const innerSchema = (zodSchema as any)._def.shape();
    return new Type(innerSchema, propName);
  }

  /**
   * Creates a validation schema from a component configuration
   * This method should be implemented by each component to apply its specific validation rules
   * @param config The component configuration
   * @returns The component schema instance with validation rules applied
   */
  abstract fromConfig(config: C): this;
}