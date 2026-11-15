import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { connectorManifestSchema, type ConnectorManifest } from '@repo/fintivio/schemas';
import { connectors, connectorVersions } from '../entities';
import type { Databases } from '../clients/database.client';
import { DATABASES } from '../injector/tokens/databases.token';
import { BadRequestError, ConflictError, NotFoundError } from '../http/errors';

export interface RegisteredConnector {
  id: string;
  name: string;
  status: 'active' | 'revoked';
  /** Latest approved version, the one installations use. */
  manifest: ConnectorManifest | null;
  versions: Array<{ version: string; status: string; approvedBy: string | null; approvedAt: Date | null; manifestUrl: string }>;
}

export const REGISTRY_CHANNEL = 'connector_registry';

const semverKey = (version: string) => version.split('.').map((n) => n.padStart(6, '0')).join('.');

/**
 * The connector registry (docs/plans/03): approved connector versions, cached in memory for the engine (component
 * resolution is synchronous) and refreshed periodically. First-party connectors only: registering fetches the
 * manifest from the connector; a platform admin approves versions (automatic in local development).
 */
@Injectable()
export class ConnectorRegistry implements OnModuleInit, OnModuleDestroy {
  private cache = new Map<string, ConnectorManifest>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(@Inject(DATABASES) private readonly databases: Databases) { }

  async onModuleInit() {
    await this.refresh().catch((error) => console.error('connector registry refresh failed', error));
    // Registrations, approvals and revocations NOTIFY this channel (also from `scripts/connectors.ts`); the interval is a
    // safety net for missed notifications.
    await this.databases.listen?.(REGISTRY_CHANNEL, () => void this.refresh().catch(() => undefined))
      .catch((error: Error) => console.error('connector registry LISTEN failed', error.message));
    this.timer = setInterval(() => void this.refresh().catch(() => undefined), 60_000);
  }

  private async changed() {
    await this.refresh();
    await this.databases.notify?.(REGISTRY_CHANNEL).catch(() => undefined);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async refresh() {
    const rows = await this.databases.platform.select({ version: connectorVersions, connector: connectors }).from(connectorVersions)
      .innerJoin(connectors, eq(connectors.id, connectorVersions.connectorId))
      .where(and(eq(connectorVersions.status, 'approved'), eq(connectors.status, 'active')));
    const next = new Map<string, ConnectorManifest>();
    for (const { version } of rows.sort((a, b) => semverKey(a.version.version).localeCompare(semverKey(b.version.version)))) {
      next.set(version.connectorId, version.manifest as ConnectorManifest);
    }
    this.cache = next;
  }

  /** The approved manifest of a connector (synchronous, from the cache). */
  manifest(connectorId: string): ConnectorManifest | null {
    return this.cache.get(connectorId) ?? null;
  }

  manifests(): ConnectorManifest[] {
    return [...this.cache.values()];
  }

  async fetchManifest(manifestUrl: string): Promise<ConnectorManifest> {
    let raw: unknown;
    try {
      const response = await fetch(manifestUrl, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      raw = await response.json();
    } catch (error) {
      throw new BadRequestError(`Could not fetch the manifest at ${manifestUrl}: ${(error as Error).message}`);
    }
    const parsed = connectorManifestSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestError(`Invalid manifest: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
    }
    return parsed.data;
  }

  /** Register (or update) a connector version from its manifest URL; new versions start as drafts. */
  async register(manifestUrl: string, options: { replaceApproved?: boolean } = {}) {
    const manifest = await this.fetchManifest(manifestUrl);
    const hash = createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
    await this.databases.platform.insert(connectors).values({ id: manifest.id, name: manifest.name })
      .onConflictDoUpdate({ target: connectors.id, set: { name: manifest.name } });
    const [existing] = await this.databases.platform.select().from(connectorVersions)
      .where(and(eq(connectorVersions.connectorId, manifest.id), eq(connectorVersions.version, manifest.version)));
    if (existing) {
      if (existing.manifestHash !== hash) {
        if (existing.status === 'approved' && !options.replaceApproved) throw new ConflictError(`Version ${manifest.version} of ${manifest.id} is approved and its manifest changed: publish a new version`);
        await this.databases.platform.update(connectorVersions).set({ manifest, manifestHash: hash, manifestUrl }).where(eq(connectorVersions.id, existing.id));
      }
      return { manifest, status: existing.status };
    }
    await this.databases.platform.insert(connectorVersions).values({ connectorId: manifest.id, version: manifest.version, manifest, manifestHash: hash, manifestUrl });
    return { manifest, status: 'draft' as const };
  }

  async approve(connectorId: string, version: string, by: string) {
    const [row] = await this.databases.platform.update(connectorVersions).set({ status: 'approved', approvedBy: by, approvedAt: new Date() })
      .where(and(eq(connectorVersions.connectorId, connectorId), eq(connectorVersions.version, version))).returning();
    if (!row) throw new NotFoundError('Connector version not found');
    await this.databases.platform.update(connectors).set({ status: 'active' }).where(eq(connectors.id, connectorId));
    await this.changed();
    return row;
  }

  /** Kill switch: every installation of the connector stops working at once. */
  async revoke(connectorId: string) {
    const [row] = await this.databases.platform.update(connectors).set({ status: 'revoked' }).where(eq(connectors.id, connectorId)).returning();
    if (!row) throw new NotFoundError('Connector not found');
    await this.changed();
    return row;
  }

  async list(): Promise<RegisteredConnector[]> {
    const rows = await this.databases.platform.select().from(connectors);
    const versions = await this.databases.platform.select().from(connectorVersions).orderBy(desc(connectorVersions.createdAt));
    return rows.map((c) => ({
      id: c.id, name: c.name, status: c.status,
      manifest: c.status === 'active' ? this.manifest(c.id) : null,
      versions: versions.filter((v) => v.connectorId === c.id)
        .map((v) => ({ version: v.version, status: v.status, approvedBy: v.approvedBy, approvedAt: v.approvedAt, manifestUrl: v.manifestUrl })),
    }));
  }
}

/** Absolute URL of a path declared in a manifest. */
export const connectorUrl = (manifest: ConnectorManifest, path: string) => new URL(path, manifest.baseUrl.endsWith('/') ? manifest.baseUrl : `${manifest.baseUrl}/`).toString();
