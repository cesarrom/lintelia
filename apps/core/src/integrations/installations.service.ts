import { Inject, Injectable, Scope } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { Tenant, User } from '@repo/lintelia/schemas';
import { connectorInstallationIndex, connectorInstallations, caseRecords, sysWorkflows, workflowVersions } from '../entities';
import type { Databases } from '../clients/database.client';
import { DATABASES } from '../injector/tokens/databases.token';
import { TENANT } from '../injector/tokens/tenant.token';
import { USER } from '../injector/tokens/user.token';
import { AuditWriter } from '../services/audit.writer';
import { tenantWebUrl } from '../constants';
import { BadRequestError, ConflictError, NotFoundError } from '../http/errors';
import { ConnectorRegistry, connectorUrl } from './registry';
import { ConnectorApiService } from './connector-api.service';
import { ConnectorInvoker } from './connector-invoker';

/**
 * The institution's connections (docs/plans/03): the catalogue of approved connectors, installing (connect flow with
 * an exchange code), opening a connector's settings page, removing, and dynamic options for the workflow editor.
 */
@Injectable({ scope: Scope.REQUEST })
export class InstallationsService {
  constructor(
    @Inject(DATABASES) private readonly databases: Databases,
    @Inject(ConnectorRegistry) private readonly registry: ConnectorRegistry,
    @Inject(ConnectorApiService) private readonly connectorApi: ConnectorApiService,
    @Inject(ConnectorInvoker) private readonly invoker: ConnectorInvoker,
    @Inject(TENANT) private readonly tenant: Tenant,
    @Inject(USER) private readonly user: User,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
  ) { }

  private get db() {
    return this.databases.forTenant(this.tenant.id);
  }

  private get actor() {
    return { type: this.user.kind, id: this.user.userId, email: this.user.email };
  }

  catalog() {
    return this.registry.manifests().filter((m) => m.audiences.includes('tenant')).map((m) => ({
      id: m.id, name: m.name, description: m.description, version: m.version, publisher: m.publisher, categories: m.categories, icon: m.icon,
      scopes: m.scopes, docsUrl: m.ui.docs ? connectorUrl(m, m.ui.docs.url) : null,
      components: m.components.map((c) => ({ key: c.key, title: c.title, description: c.description, kind: c.kind })),
    }));
  }

  async list() {
    const rows = await this.db.select().from(connectorInstallations).orderBy(desc(connectorInstallations.createdAt));
    return rows.filter((r) => r.status !== 'disabled').map((r) => ({
      id: r.id, connectorId: r.connectorId, connectorVersion: r.connectorVersion, displayName: r.displayName, status: r.status,
      configSummary: r.configSummary, lastError: r.lastError, scopes: r.grantedScopes, createdBy: r.createdByEmail, createdAt: r.createdAt,
      connectorName: this.registry.manifest(r.connectorId)?.name ?? r.connectorId, available: !!this.registry.manifest(r.connectorId),
    }));
  }

  private async load(installationId: string) {
    const [row] = await this.db.select().from(connectorInstallations).where(eq(connectorInstallations.id, installationId));
    if (!row || row.status === 'disabled') throw new NotFoundError('Connection not found');
    const manifest = this.registry.manifest(row.connectorId);
    if (!manifest) throw new NotFoundError('This connector is no longer available');
    return { row, manifest };
  }

  private async handOff(row: typeof connectorInstallations.$inferSelect, purpose: 'connect' | 'setup') {
    const manifest = this.registry.manifest(row.connectorId)!;
    const returnUrl = tenantWebUrl(this.tenant.domain, `/app/integrations?${purpose === 'connect' ? 'installed' : 'updated'}=${row.id}`);
    const code = await this.connectorApi.issueCode({
      installationId: row.id, tenantId: this.tenant.id, connectorId: row.connectorId, purpose, returnUrl,
      user: { id: this.user.userId, email: this.user.email, name: this.user.name ?? null },
      tenant: { name: this.tenant.name, domain: this.tenant.domain, pallette: this.tenant.pallette },
    });
    const page = purpose === 'connect' ? manifest.ui.connect : manifest.ui.setup ?? manifest.ui.connect;
    const url = new URL(connectorUrl(manifest, page.url));
    url.searchParams.set('code', code);
    url.searchParams.set('installation', row.id);
    return { url: url.toString(), mode: page.mode };
  }

  /** Start connecting: a pending installation and the connector's connect page (with a single-use code). */
  async install(connectorId: string) {
    const manifest = this.registry.manifest(connectorId);
    if (!manifest || !manifest.audiences.includes('tenant')) throw new NotFoundError('Connector not available');
    const [row] = await this.db.insert(connectorInstallations).values({
      connectorId, connectorVersion: manifest.version, displayName: manifest.name, grantedScopes: manifest.scopes,
      createdByEmail: this.user.email, audience: 'tenant',
    }).returning();
    await this.databases.platform.insert(connectorInstallationIndex).values({ installationId: row.id, tenantId: this.tenant.id, connectorId });
    await this.audit.record(this.tenant.id, this.actor, 'integration.install_started', { type: 'integration', id: row.id, name: manifest.name }, { connector: connectorId, version: manifest.version, scopes: manifest.scopes });
    return { installationId: row.id, ...(await this.handOff(row, 'connect')) };
  }

  async setupSession(installationId: string) {
    const { row } = await this.load(installationId);
    return this.handOff(row, row.status === 'pending' ? 'connect' : 'setup');
  }

  /** Remove a connection; the connector is told (`uninstalled`) so it deletes its secrets and data. */
  async uninstall(installationId: string) {
    const { row, manifest } = await this.load(installationId);
    // Published workflows whose steps use this connection would fail: retire them (or change the step) first.
    const users = await this.db.select({ name: sysWorkflows.name, version: workflowVersions.version }).from(workflowVersions)
      .innerJoin(sysWorkflows, eq(sysWorkflows.id, workflowVersions.workflowId))
      .where(and(eq(workflowVersions.status, 'active'), sql`position(${installationId} in ${workflowVersions.yaml}) > 0`));
    if (users.length) {
      throw new ConflictError(`Used by published workflows: ${users.map((u) => `${u.name} v${u.version}`).join(', ')}. Retire them or change their steps first.`);
    }
    await this.db.update(connectorInstallations).set({ status: 'disabled' }).where(eq(connectorInstallations.id, installationId));
    await this.databases.platform.delete(connectorInstallationIndex).where(eq(connectorInstallationIndex.installationId, installationId));
    await this.audit.record(this.tenant.id, this.actor, 'integration.removed', { type: 'integration', id: row.id, name: row.displayName }, { connector: row.connectorId });
    if (manifest.lifecycle?.url) {
      const body = JSON.stringify({ event: 'uninstalled', installationId, at: new Date().toISOString() });
      await fetch(connectorUrl(manifest, manifest.lifecycle.url), {
        method: 'POST', headers: await this.invoker.requestHeaders(manifest.id, installationId, body), body, signal: AbortSignal.timeout(10_000),
      }).catch((error) => console.error('lifecycle notification failed', manifest.id, error));
    }
    return { removed: true };
  }

  /** Dynamic options for a component field (e.g. Didit workflows, Documenso templates), proxied to the connector. */
  async options(installationId: string, name: string) {
    const { row, manifest } = await this.load(installationId);
    if (!manifest.options) throw new BadRequestError('This connector has no dynamic options');
    const body = JSON.stringify({ installationId: row.id, name });
    const response = await fetch(connectorUrl(manifest, manifest.options.url), {
      method: 'POST', headers: await this.invoker.requestHeaders(manifest.id, row.id, body), body, signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new BadRequestError(`The connector could not list ${name} (${response.status})`);
    return response.json();
  }

  /** Canonical records of a case (verification results, signature requests, messages). */
  async recordsOfCase(caseId: string) {
    return this.db.select().from(caseRecords).where(and(eq(caseRecords.caseId, caseId))).orderBy(desc(caseRecords.createdAt));
  }
}
