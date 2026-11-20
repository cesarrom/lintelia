import { Inject, Injectable, Scope } from '@nestjs/common';
import { eq, ne } from 'drizzle-orm';
import { validateClientApp, type Tenant } from '@repo/lintelia/schemas';
import { connectorInstallations, sysForms, sysWorkflows, workflowVersions } from '../entities';
import { CASE_REPOSITORY } from '../engine/engine.client';
import type { CaseRepository } from '../engine/case-repository';
import { getComponent } from '../engine/components';
import { TENANT } from '../injector/tokens/tenant.token';
import { ConnectorRegistry } from '../integrations/registry';
import { loadApp } from '../client-apps/runtime-data';
import { blankApp } from '../client-apps/templates';
import { checkExpression } from '../client-apps/studio.service';
import { workflowMap, type ComponentInfo } from './model';

/**
 * Everything the experience map draws, in one answer (docs/plans/13): the client app's draft, every workflow as a map
 * (touchpoints, flow, calls, triggers), forms and connections. Drafts, not published versions: the map is where
 * people build.
 */
@Injectable({ scope: Scope.REQUEST })
export class ExperienceMapService {
  constructor(
    @Inject(CASE_REPOSITORY) private readonly repository: CaseRepository,
    @Inject(ConnectorRegistry) private readonly registry: ConnectorRegistry,
    @Inject(TENANT) private readonly tenant: Tenant,
  ) { }

  private get db() {
    return this.repository.db(this.tenant.id);
  }

  async map() {
    const db = this.db;
    const app = await loadApp(db);
    const rows = await db.select().from(sysWorkflows);
    const active = new Map((await db.select({ workflowId: workflowVersions.workflowId, version: workflowVersions.version }).from(workflowVersions).where(eq(workflowVersions.status, 'active')))
      .map((r) => [r.workflowId, r.version]));
    const connections = await db.select().from(connectorInstallations).where(ne(connectorInstallations.status, 'disabled'));

    const cache = new Map<string, ComponentInfo | null>();
    const describe = (type: string): ComponentInfo | null => {
      if (!cache.has(type)) {
        const component = getComponent(type);
        const source = component?.definition.source;
        const connectorId = source?.kind === 'connector' ? source.connectorId : type.startsWith('connector:') ? type.slice(10).split('/')[0] : undefined;
        const functionId = source?.kind === 'function' ? source.workflowId : undefined;
        cache.set(type, component ? {
          title: functionId ? rows.find((r) => r.id === functionId)?.name ?? component.definition.title : component.definition.title,
          kind: component.definition.kind, category: component.definition.category, icon: component.definition.icon,
          connectorId, connectorName: connectorId ? this.registry.manifest(connectorId)?.name ?? connectorId : undefined,
        } : connectorId ? { title: type, kind: 'automatic', category: 'connector', connectorId, connectorName: connectorId } : null);
      }
      return cache.get(type)!;
    };

    const workflows = rows.map((w) => workflowMap({ id: w.id, name: w.name, description: w.description, yaml: w.yaml, status: active.has(w.id) ? 'active' : 'draft', activeVersion: active.get(w.id) ?? null }, describe))
      .sort((a, b) => a.name.localeCompare(b.name));
    const forms = (await db.select().from(sysForms)).map((f) => ({ id: f.id, name: f.name, description: f.description, workflowId: f.workflowId, published: !!f.publishedAt, publicKey: f.publicKey }));
    const definition = (app?.draft ?? blankApp()) as Record<string, unknown>;
    return {
      institution: { name: this.tenant.name, pallette: this.tenant.pallette, logoUrl: this.tenant.logoUrl },
      app: {
        exists: !!app, name: app?.name ?? null, activeVersion: app?.activeVersion ?? null, definition,
        errors: validateClientApp(definition, { workflows: workflows.map((w) => ({ id: w.id, name: w.name, active: w.status === 'active' })), checkExpression }),
      },
      workflows,
      forms,
      connections: connections.map((c) => ({ id: c.id, connectorId: c.connectorId, name: c.displayName ?? this.registry.manifest(c.connectorId)?.name ?? c.connectorId, status: c.status })),
    };
  }
}
