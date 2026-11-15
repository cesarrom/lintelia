import { Injectable, Inject, Scope } from "@nestjs/common";
import type { Tenant } from "@repo/fintivio/schemas";
import { AbstractService } from "./service";
import { TENANT } from "../injector/tokens/tenant.token";
import { STORAGE_PROVIDER, type StorageProvider } from "../providers/storage.provider";
import { AUTH_CONTEXT } from "../injector/tokens/auth-context.token";
import type { AuthContext } from "../auth/auth-context";

const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
  xml: 'application/xml',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/**
 * Tenant files. Object keys are namespaced by tenant (`tenants/<tenant id>/<path>`), so a path supplied by one tenant
 * can never resolve to another tenant's object.
 */
@Injectable({
  scope: Scope.REQUEST
})
export class FilesService extends AbstractService {
  constructor(
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    @Inject(TENANT) private readonly tenant: Tenant | null,
    @Inject(AUTH_CONTEXT) private readonly auth: AuthContext,
  ) {
    super();
  }

  /** Storage namespace of the caller: the tenant, or the platform area for staff (e.g. logos before onboarding). */
  private namespace() {
    if (this.tenant) return `tenants/${this.tenant.id}`;
    if (this.auth.claims?.kind === 'staff') return 'platform';
    throw new Error('Files require a tenant context');
  }

  private key(path: string) {
    const clean = path.replace(/^\/+/, '');
    if (!clean || clean.split('/').some((segment) => !segment || segment === '..' || segment === '.')) {
      throw new Error(`Invalid file path: ${path}`);
    }
    return `${this.namespace()}/${clean}`;
  }

  /** A fresh object key for an upload by the current user (uploads never overwrite each other). */
  newUploadKey(filename: string) {
    const safeName = (filename.split(/[\\/]/).pop() || 'file').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120);
    const owner = this.auth.user?.userId ?? 'anonymous';
    return `uploads/${owner}/${crypto.randomUUID()}-${safeName}`;
  }

  getContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    return (ext && MIME_TYPES[ext]) || 'application/octet-stream';
  }

  async putFile(file: File, path: string) {
    await this.storage.put(this.key(path), new Uint8Array(await file.arrayBuffer()), file.type || this.getContentType(path));
    return { key: path };
  }

  async uploadFile(file: Buffer, name: string) {
    await this.storage.put(this.key(name), file, this.getContentType(name));
    return { key: name };
  }

  async downloadFile(path: string): Promise<Buffer> {
    const object = await this.storage.get(this.key(path));
    if (!object) throw new Error(`File not found: ${path}`);
    return object.body;
  }

  async getObject(path: string) {
    return this.storage.get(this.key(path));
  }

  /** A URL a third party can read. Locally that is a data URL (nothing is exposed without authentication). */
  async getSignedUrl(path: string) {
    const object = await this.storage.get(this.key(path));
    if (!object) throw new Error(`File not found: ${path}`);
    return `data:${object.contentType};base64,${object.body.toString('base64')}`;
  }

  async downloadWithMetadataFile(path: string) {
    const object = await this.storage.get(this.key(path));
    if (!object) throw new Error(`File not found: ${path}`);
    return {
      Body: `data:${object.contentType};base64,${object.body.toString('base64')}`,
      ContentType: object.contentType,
      ContentDisposition: `inline; filename="${path.split('/').pop()}"`,
    };
  }
}
