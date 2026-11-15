import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { createDatabases, type Databases } from '../../clients/database.client';
import { env } from '../../constants';

export const DATABASES = Symbol.for('DATABASES');

export const DATABASES_PROVIDER = {
  provide: DATABASES,
  useFactory: (): Databases => createDatabases({ app: env.DATABASE_URL, platform: env.DATABASE_PLATFORM_URL }),
};

@Injectable()
export class DatabasesLifecycle implements OnApplicationShutdown {
  constructor(@Inject(DATABASES) private readonly databases: Databases) { }

  async onApplicationShutdown() {
    await this.databases.close();
  }
}
