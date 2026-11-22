import { IFormComponent } from './schemas';

/**
 * Form Component Registry
 * 
 * Manages the registration and retrieval of form components.
 * Each component provides its own UI components, configuration schema,
 * and value validation schema.
 */
class ComponentRegistry {
  private components = new Map<string, IFormComponent>();

  register(component: IFormComponent) {
    if (this.components.has(component.type)) {
      throw new Error(`Component type "${component.type}" is already registered`);
    }
    this.components.set(component.type, component);
  }

  get(type: string): IFormComponent | undefined {
    return this.components.get(type);
  }

  getAll(): IFormComponent[] {
    return Array.from(this.components.values());
  }

  getByCategory(category: string): IFormComponent[] {
    return this.getAll().filter(component => component.category === category);
  }
}

// Export a singleton instance
export const registry = new ComponentRegistry(); 