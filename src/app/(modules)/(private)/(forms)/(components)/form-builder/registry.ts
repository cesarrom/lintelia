import { z } from 'zod';
import { ComponentDefinition, ComponentCategory } from './types';

class ComponentRegistry {
  private components: Map<string, ComponentDefinition<any, any, any>> = new Map();

  register<
    TConfig extends z.ZodType,
    TInput extends z.ZodType,
    TOutput extends z.ZodType
  >(
    component: ComponentDefinition<TConfig, TInput, TOutput>
  ) {
    if (this.components.has(component.type)) {
      throw new Error(`Component type "${component.type}" is already registered`);
    }
    this.components.set(component.type, component);
  }

  get<
    TConfig extends z.ZodType,
    TInput extends z.ZodType,
    TOutput extends z.ZodType
  >(
    type: string
  ): ComponentDefinition<TConfig, TInput, TOutput> | undefined {
    return this.components.get(type) as ComponentDefinition<TConfig, TInput, TOutput> | undefined;
  }

  getAll(): ComponentDefinition<any, any, any>[] {
    return Array.from(this.components.values());
  }

  getByCategory(category: ComponentCategory): ComponentDefinition<any, any, any>[] {
    return this.getAll().filter(component => component.category === category);
  }
}

export const registry = new ComponentRegistry(); 