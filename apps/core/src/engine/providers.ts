import type { Databases } from '../clients/database.client';
import { DATABASES } from '../injector/tokens/databases.token';
import { EMAIL_PROVIDER, type EmailProvider } from '../providers/email.provider';
import { CaseRepository } from './case-repository';
import { CASE_REPOSITORY, ENGINE_CLIENT, EngineClient } from './engine.client';
import { Notifier } from './notifier';

export const NOTIFIER = Symbol.for('NOTIFIER');

export const ENGINE_PROVIDERS = [
  { provide: CASE_REPOSITORY, inject: [DATABASES], useFactory: (databases: Databases) => new CaseRepository(databases) },
  { provide: ENGINE_CLIENT, useFactory: () => new EngineClient() },
  { provide: NOTIFIER, inject: [EMAIL_PROVIDER], useFactory: (email: EmailProvider) => new Notifier(email) },
];
