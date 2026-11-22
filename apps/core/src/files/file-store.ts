import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { caseFiles, uploads, type IntakeReport } from '../entities';
import type { Databases } from '../clients/database.client';
import { DATABASES } from '../injector/tokens/databases.token';
import { env } from '../constants';
import { INTERNAL_SIGNATURE_HEADER, internalSignature } from '../auth/internal-signature';
import { cleanKey, LocalObjectStore, quarantineKey, type ObjectStore } from './object-store';
import { HttpSanitizer, HttpScanner, type ContentSanitizer, type MalwareScanner } from './intake';

export const sha256Hex = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** Storage, scanning and the upload records shared by the HTTP side and the durable intake pipeline. */
@Injectable()
export class FileStore {
  readonly objects: ObjectStore = new LocalObjectStore();
  readonly scanner: MalwareScanner = new HttpScanner();
  readonly sanitizer: ContentSanitizer = new HttpSanitizer();

  constructor(@Inject(DATABASES) private readonly databases: Databases) { }

  db(tenantId: string) {
    return this.databases.forTenant(tenantId);
  }

  async upload(tenantId: string, uploadId: string) {
    const [row] = await this.db(tenantId).select().from(uploads).where(eq(uploads.id, uploadId)).limit(1);
    return row ?? null;
  }

  async updateUpload(tenantId: string, uploadId: string, changes: Partial<typeof uploads.$inferInsert>) {
    const [row] = await this.db(tenantId).update(uploads).set(changes).where(eq(uploads.id, uploadId)).returning();
    return row;
  }

  async reject(tenantId: string, uploadId: string, reason: string, report: IntakeReport) {
    await this.objects.delete(quarantineKey(tenantId, uploadId)).catch(() => undefined);
    return this.updateUpload(tenantId, uploadId, { status: 'rejected', rejectionReason: reason, report: { ...report, reason } });
  }

  /** Store the sanitised bytes in the clean area and create the case file. */
  async accept(tenantId: string, uploadId: string, content: Buffer, contentType: string, report: IntakeReport, uploadedByEmail: string | null) {
    const upload = (await this.upload(tenantId, uploadId))!;
    const [file] = await this.db(tenantId).insert(caseFiles).values({
      caseId: upload.caseId!, taskId: upload.taskId, itemKey: upload.itemKey, uploadId, name: upload.declaredName, size: content.length,
      contentType, sha256: sha256Hex(content), kind: upload.kind, storageKey: 'pending', source: upload.ownerType, uploadedById: upload.ownerId, uploadedByEmail, report,
    }).returning();
    const key = cleanKey(tenantId, file.id);
    await this.objects.put(key, content);
    await this.db(tenantId).update(caseFiles).set({ storageKey: key }).where(eq(caseFiles.id, file.id));
    await this.objects.delete(quarantineKey(tenantId, uploadId)).catch(() => undefined);
    await this.updateUpload(tenantId, uploadId, { status: 'available', fileId: file.id, report });
    return file;
  }

  /** Start the durable intake of an upload (through the Restate ingress, signed). */
  async startIntake(tenantId: string, uploadId: string) {
    const response = await fetch(new URL('/fileIntake/process/send', env.RESTATE_ENDPOINT), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [INTERNAL_SIGNATURE_HEADER]: internalSignature('intake', tenantId, uploadId), 'idempotency-key': `intake:${uploadId}` },
      body: JSON.stringify({ tenantId, uploadId }),
    });
    if (!response.ok) throw new Error(`File intake could not start: ${response.status} ${await response.text()}`);
  }
}
