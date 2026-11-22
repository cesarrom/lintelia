import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { tenants } from '../entities';
import type { Databases } from '../clients/database.client';
import { DATABASES } from '../injector/tokens/databases.token';
import { syncSystemRoles } from '../tenancy/provisioning';

/** On startup, make sure every tenant has the system roles of the current catalogue. */
@Injectable()
export class SystemRolesSync implements OnApplicationBootstrap {
  constructor(@Inject(DATABASES) private readonly databases: Databases) { }

  async onApplicationBootstrap() {
    const all = await this.databases.platform.select({ id: tenants.id }).from(tenants);
    for (const tenant of all) {
      try {
        await syncSystemRoles(this.databases, tenant.id);
      } catch (error) {
        console.error(`Could not sync system roles of tenant ${tenant.id}`, error);
      }
    }
  }
}
