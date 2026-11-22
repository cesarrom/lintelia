import type { Databases } from '../../clients/database.client';
import { DATABASES } from './databases.token';

/** Platform connection (`lintelia_platform`): tenant directory and staff accounts. Never tenant data. */
export const PLATFORM_CONNECTION = Symbol.for('PLATFORM_CONNECTION');
export const PLATFORM_CONNECTION_PROVIDER = {
  provide: PLATFORM_CONNECTION,
  inject: [DATABASES],
  useFactory: (databases: Databases) => databases.platform,
};
