import { Inject, Injectable, Scope } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { ComponentDefinition, Tenant } from '@repo/lintelia/schemas';
import { connectorInstallations } from '../entities';
import type { Databases } from '../clients/database.client';
import { DATABASES } from '../injector/tokens/databases.token';
import { TENANT } from '../injector/tokens/tenant.token';
import { ConnectorRegistry } from './registry';
import { connectorComponentDefinition } from './connector-components';

/** Components contributed by the institution's active connections (docs/plans/03), one entry per component. */
@Injectable({ scope: Scope.REQUEST })
export class ConnectorComponentsService {
  constructor(
    @Inject(DATABASES) private readonly databases: Databases,
    @Inject(ConnectorRegistry) private readonly registry: ConnectorRegistry,
    @Inject(TENANT) private readonly tenant: Tenant | null,
  ) { }

  async definitionsForTenant(): Promise<ComponentDefinition[]> {
    if (!this.tenant) return [];
    const rows = await this.databases.forTenant(this.tenant.id).select().from(connectorInstallations).where(eq(connectorInstallations.status, 'active'));
    const definitions = new Map<string, ComponentDefinition>();
    for (const row of rows) {
      const manifest = this.registry.manifest(row.connectorId);
      if (!manifest) continue;
      for (const component of manifest.components) {
        const definition = connectorComponentDefinition(manifest, component, { id: row.id, displayName: row.displayName });
        // One palette entry per component; the first connection is the default, others are chosen in the step.
        if (!definitions.has(definition.type)) definitions.set(definition.type, definition);
      }
    }
    return [...definitions.values()];
  }
}
