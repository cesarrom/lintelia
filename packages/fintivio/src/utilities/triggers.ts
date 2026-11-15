import { get, set } from 'lodash';
import { v4 as uuid } from 'uuid';
import { LogCategory, TriggerAction, TriggerDefinition } from '../schemas/shared.schema';

export class TriggerBuilder {
  public static readonly Sources = {
    DATABASE: 'DATABASE',
    FORM: 'FORM',
    USER: 'USER',
    WORKFLOW: 'WORKFLOW',
    INTEGRATION: 'INTEGRATION',
    AUTH: 'AUTH',
  } as const;

  public static readonly Categories = {
    DATABASE: 'database',
    FORM: 'form',
    USER: 'user',
    WORKFLOW: 'workflow',
    INTEGRATION: 'integration',
    SECURITY: 'security',
    REVIEW: 'review',
    SYSTEM: 'system',
  } as const;

  public static readonly Events = {
    // database
    DATABASE_INSERT: 'database-insert',
    DATABASE_UPDATE: 'database-update',
    DATABASE_DELETE: 'database-delete',
    DATABASE_SELECT: 'database-select',
    DATABASE_CREATE: 'database-create',
    DATABASE_ALTER: 'database-alter',
    DATABASE_DROP: 'database-drop',
    // form
    FORM_SUBMISSION: 'form-submission',
    // user
    USER_SIGNUP: 'user-signup',
    USER_SIGNIN: 'user-signin',
    USER_DELETE: 'user-delete',
    // workflow
    WORKFLOW_START: 'workflow-start',
    WORKFLOW_END: 'workflow-end',
    // integration
    API_WEBHOOK: 'api-webhook',
    // review
    REVIEW_START: 'review-start',
    REVIEW_END: 'review-end',
  } as const;
  private definition: Partial<TriggerDefinition> = {
    pattern: {},
    action: { type: 'INVOKE' } as TriggerAction
  };

  constructor(name: string) {
    this.definition.id = uuid();
    this.definition.name = name;
  }

  name(name: string): this {
    set(this, ['definition', 'name'], name);
    return this;
  }

  type(type: string): this {
    set(this, ['definition', 'type'], type);
    return this;
  }

  static fromJSON(json: TriggerDefinition): TriggerBuilder {
    const builder = new TriggerBuilder(json.name);
    builder.definition = json;
    return builder;
  }

  description(description: string): this {
    set(this, ['definition', 'description'], description);
    return this;
  }

  // Pattern matching methods
  matchCategory(pattern: LogCategory): this {
    set(this, ['definition', 'pattern', 'category'], pattern);
    return this;
  }

  matchMessage(pattern: string): this {
    set(this, ['definition', 'pattern', 'message'], pattern);
    return this;
  }

  matchLevel(level: string): this {
    set(this, ['definition', 'pattern', 'level'], level);
    return this;
  }

  matchSource(pattern: string): this {
    set(this, ['definition', 'pattern', 'source'], pattern);
    return this;
  }

  private serializeMetadata(metadata: any): string {
    return `${metadata.path.join(',')}||${JSON.stringify(metadata.pattern)}`;
  }

  private deserializeMetadata(metadata: string): any {
    const [path, pattern] = metadata.split('||');
    return { path: path.split(','), pattern: JSON.parse(pattern) };
  }

  matchMetadata(path: string[], pattern: unknown): this {
    const metadata: any[] = get(this, ['definition', 'pattern', 'metadata']) || [];
    const metadataSet = new Set(metadata.map(m => this.serializeMetadata(m)));
    const newItem = this.serializeMetadata({ path, pattern });

    if (!metadataSet.has(newItem)) {
      metadataSet.add(newItem);
    }

    set(this, ['definition', 'pattern', 'metadata'], Array.from(metadataSet).map(i => this.deserializeMetadata(i)));

    return this;
  }

  // Action methods
  invokeWorkflow(workflowId: string, inputs?: Record<string, unknown>): this {
    this.definition.action = {
      type: 'INVOKE',
      workflowId,
      inputs
    };
    return this;
  }

  resumeWorkflow(workflowId: string, nodeId: string, inputs?: Record<string, unknown>): this {
    this.definition.action = {
      type: 'RESUME',
      workflowId,
      nodeId,
      inputs
    };
    return this;
  }

  // Build method returns the trigger definition
  build(): TriggerDefinition {
    return this.definition as TriggerDefinition;
  }

  static validate(definition: TriggerDefinition) {
    if (!definition.name) {
      throw new Error('Trigger name is required');
    }

    if (!definition.action) {
      throw new Error('Trigger action is required');
    }
  }

  // Static helper methods for common triggers
  static onFormSubmission(formId: string, workflowId: string) {
    return new TriggerBuilder(`form-submission-${formId}`)
      .description(`Trigger when form ${formId} is submitted`)
      .matchCategory('form')
      .matchMessage('Form answers submitted')
      .matchMetadata(['formId'], formId)
      .invokeWorkflow(workflowId, {
        formId: '{{metadata.formId}}',
        instanceId: '{{metadata.instanceId}}'
      });
  }

  static onUserSignup(workflowId: string) {
    return new TriggerBuilder('user-signup')
      .description('Trigger when a new user signs up')
      .matchCategory('security')
      .matchMessage('User signed up')
      .invokeWorkflow(workflowId, {
        userId: '{{metadata.userId}}',
        email: '{{metadata.email}}'
      });
  }

  static onDatabaseChange(table: string, operation: 'insert' | 'update' | 'delete', workflowId: string) {
    return new TriggerBuilder(`db-${operation}-${table}`)
      .description(`Trigger on ${operation} in ${table} table`)
      .matchCategory('system')
      .matchMetadata(['table'], table)
      .matchMetadata(['operation'], operation)
      .invokeWorkflow(workflowId, {
        recordId: '{{metadata.recordId}}',
        oldData: '{{metadata.oldData}}',
        newData: '{{metadata.newData}}'
      });
  }

  static onApiWebhook(provider: string, event: string, workflowId: string) {
    return new TriggerBuilder(`webhook-${provider}-${event}`)
      .description(`Trigger on ${provider} webhook ${event}`)
      .matchCategory('integration')
      .matchSource(provider)
      .matchMetadata(['event'], event)
      .invokeWorkflow(workflowId, {
        payload: '{{metadata.payload}}'
      });
  }
}