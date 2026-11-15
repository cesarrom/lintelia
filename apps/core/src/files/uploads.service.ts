import { Inject, Injectable, Scope } from '@nestjs/common';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Tenant, User } from '@repo/fintivio/schemas';
import { caseFiles, cases, tasks, uploads } from '../entities';
import { TENANT } from '../injector/tokens/tenant.token';
import { USER } from '../injector/tokens/user.token';
import { AuditWriter } from '../services/audit.writer';
import { CasesService } from '../services/cases.service';
import { env } from '../constants';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../http/errors';
import { INTENT_TTL_MS, MAX_PENDING_INTENTS, policyFor } from './policy';
import { quarantineKey, signToken } from './object-store';
import { FileStore } from './file-store';

export interface IntentInput {
  purpose?: 'client_request_item' | 'case_document';
  caseId?: string;
  taskId?: string;
  itemKey?: string;
  name?: string;
  size?: number;
  type?: string;
  sha256?: string;
}

const DOWNLOAD_TTL_MS = 60_000;

export const presentUpload = (row: typeof uploads.$inferSelect) => ({
  id: row.id, purpose: row.purpose, caseId: row.caseId, taskId: row.taskId, itemKey: row.itemKey, name: row.declaredName, size: row.declaredSize,
  status: row.status, rejectionReason: row.rejectionReason, fileId: row.fileId, expiresAt: row.expiresAt,
  sanitization: row.report?.sanitization?.actions ?? [],
});

export const presentFile = (row: typeof caseFiles.$inferSelect) => ({
  id: row.id, caseId: row.caseId, taskId: row.taskId, itemKey: row.itemKey, name: row.name, size: row.size, contentType: row.contentType,
  kind: row.kind, source: row.source, uploadedBy: row.uploadedByEmail, createdAt: row.createdAt,
  scan: row.report?.scan?.result ?? null, sanitization: row.report?.sanitization?.actions ?? [],
});

/**
 * Uploads (docs/plans/07): intents authorised against their purpose, bytes to quarantine through a short-lived signed
 * URL, the durable intake pipeline, and signed download URLs for files the caller may see.
 */
@Injectable({ scope: Scope.REQUEST })
export class UploadsService {
  constructor(
    @Inject(FileStore) private readonly store: FileStore,
    @Inject(CasesService) private readonly cases: CasesService,
    @Inject(TENANT) private readonly tenant: Tenant,
    @Inject(USER) private readonly user: User,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
  ) { }

  private get db() {
    return this.store.db(this.tenant.id);
  }

  private get actor() {
    return { type: this.user.kind, id: this.user.userId, email: this.user.email };
  }

  /** Declare an upload; returns where to send the bytes (valid 15 minutes). */
  async createIntent(input: IntentInput) {
    const purpose = input.purpose ?? 'client_request_item';
    const name = String(input.name ?? '').replace(/[\\/\0]/g, '_').trim().slice(0, 255);
    const size = Number(input.size);
    const type = String(input.type ?? '').toLowerCase();
    if (!name) throw new BadRequestError('The file needs a name');
    if (!Number.isInteger(size) || size <= 0) throw new BadRequestError('The file size is required');
    if (input.sha256 && !/^[0-9a-f]{64}$/i.test(input.sha256)) throw new BadRequestError('sha256 must be a hex digest');

    let caseId: string | null = null;
    let taskId: string | null = null;
    let itemKey: string | null = null;
    let item: { accept?: string[]; maxSizeMb?: number } | undefined;
    if (purpose === 'client_request_item') {
      // Only the client a request is addressed to may answer it, and only for its file items.
      if (this.user.kind !== 'client') throw new ForbiddenError('Only the client can answer their requests');
      const [task] = await this.db.select().from(tasks).where(eq(tasks.id, String(input.taskId ?? ''))).limit(1);
      if (!task || task.audience !== 'client' || task.assigneeId !== this.user.userId) throw new NotFoundError('Request not found');
      if (task.status !== 'open') throw new ConflictError(`This request is ${task.status}`);
      const requestItem = (task.requestItems ?? []).find((i) => i.key === input.itemKey);
      if (!requestItem || requestItem.type !== 'file') throw new BadRequestError('This request does not ask for a file here');
      caseId = task.caseId; taskId = task.id; itemKey = requestItem.key;
      item = requestItem as { accept?: string[]; maxSizeMb?: number };
    } else if (purpose === 'case_document') {
      if (this.user.kind !== 'member' || !this.user.permissions.includes('cases:read')) throw new ForbiddenError();
      await this.cases.get(String(input.caseId ?? ''));
      caseId = String(input.caseId);
    } else {
      throw new BadRequestError('Unknown purpose');
    }

    const policy = policyFor(purpose, item);
    if (!policy.types.includes(type)) throw new BadRequestError(`This type of file is not accepted. Accepted: ${policy.types.join(', ')}`);
    if (size > policy.maxBytes) throw new BadRequestError(`The file is larger than ${Math.round(policy.maxBytes / 1024 / 1024)} MB`);
    const [{ pending }] = await this.db.select({ pending: sql<number>`count(*)::int` }).from(uploads)
      .where(and(eq(uploads.ownerId, this.user.userId), eq(uploads.status, 'pending')));
    if (pending >= MAX_PENDING_INTENTS) throw new ConflictError('Too many uploads in progress');
    if (taskId && itemKey) {
      const [{ count }] = await this.db.select({ count: sql<number>`count(*)::int` }).from(caseFiles).where(and(eq(caseFiles.taskId, taskId), eq(caseFiles.itemKey, itemKey)));
      if (count >= policy.maxFilesPerItem) throw new ConflictError(`At most ${policy.maxFilesPerItem} files here`);
    }

    const expiresAt = new Date(Date.now() + INTENT_TTL_MS);
    const [row] = await this.db.insert(uploads).values({
      purpose, ownerType: this.user.kind === 'client' ? 'client' : 'member', ownerId: this.user.userId, caseId, taskId, itemKey,
      declaredName: name, declaredSize: size, declaredType: type, declaredSha256: input.sha256?.toLowerCase() ?? null, expiresAt,
      report: item ? { item: { accept: item.accept, maxSizeMb: item.maxSizeMb } } as never : {},
    }).returning();
    const token = signToken({ t: this.tenant.id, u: row.id, s: size }, INTENT_TTL_MS);
    return {
      ...presentUpload(row),
      upload: { method: 'PUT', url: `${env.HOST.replace(/\/$/, '')}/uploads/${row.id}/content?token=${encodeURIComponent(token)}`, headers: { 'Content-Type': type }, maxBytes: policy.maxBytes },
    };
  }

  private async own(uploadId: string) {
    const [row] = await this.db.select().from(uploads).where(and(eq(uploads.id, uploadId), eq(uploads.ownerId, this.user.userId))).limit(1);
    if (!row) throw new NotFoundError('Upload not found');
    return row;
  }

  /** The bytes arrived (the client says so; with a cloud store, a bucket notification does): start the intake. */
  async complete(uploadId: string) {
    const row = await this.own(uploadId);
    if (row.status !== 'pending') return presentUpload(row);
    if (row.expiresAt < new Date()) {
      await this.store.updateUpload(this.tenant.id, row.id, { status: 'expired' });
      throw new ConflictError('This upload expired: please try again');
    }
    const size = await this.store.objects.size(quarantineKey(this.tenant.id, row.id));
    if (size === null) throw new ConflictError('The file has not been received yet');
    const updated = await this.store.updateUpload(this.tenant.id, row.id, { status: 'uploaded' });
    await this.audit.record(this.tenant.id, this.actor, 'file.uploaded', { type: 'upload', id: row.id, name: row.declaredName }, { size, purpose: row.purpose }, row.caseId);
    await this.store.startIntake(this.tenant.id, row.id);
    return presentUpload(updated);
  }

  async status(uploadId: string) {
    return presentUpload(await this.own(uploadId));
  }

  /** Files of a case the caller may see (members: case scope; clients: the files they sent on their own case). */
  async filesOfCase(caseId: string) {
    if (this.user.kind === 'client') {
      const [kase] = await this.db.select({ id: cases.id }).from(cases).where(and(eq(cases.id, caseId), eq(cases.applicantId, this.user.userId))).limit(1);
      if (!kase) throw new NotFoundError('Case not found');
      const rows = await this.db.select().from(caseFiles).where(and(eq(caseFiles.caseId, caseId), eq(caseFiles.uploadedById, this.user.userId))).orderBy(desc(caseFiles.createdAt));
      return rows.map(presentFile);
    }
    await this.cases.get(caseId);
    const rows = await this.db.select().from(caseFiles).where(eq(caseFiles.caseId, caseId)).orderBy(desc(caseFiles.createdAt));
    return rows.map(presentFile);
  }

  /** A signed download URL valid for 60 seconds (always as an attachment). */
  async downloadUrl(fileId: string) {
    const [file] = await this.db.select().from(caseFiles).where(eq(caseFiles.id, fileId)).limit(1);
    if (!file) throw new NotFoundError('File not found');
    if (this.user.kind === 'client') {
      if (file.uploadedById !== this.user.userId) throw new NotFoundError('File not found');
    } else {
      await this.cases.get(file.caseId).catch(() => { throw new NotFoundError('File not found'); });
    }
    await this.audit.record(this.tenant.id, this.actor, 'file.downloaded', { type: 'file', id: file.id, name: file.name }, {}, file.caseId);
    const token = signToken({ t: this.tenant.id, k: file.storageKey, n: file.name, c: file.contentType }, DOWNLOAD_TTL_MS);
    return { url: `${env.HOST.replace(/\/$/, '')}/blobs/${token}`, expiresAt: new Date(Date.now() + DOWNLOAD_TTL_MS).toISOString() };
  }

  /** File ids answering a request item must be this client's available files for that task and item. */
  async assertAnswerFiles(taskId: string, itemKey: string, fileIds: string[]) {
    if (!fileIds.length) return [];
    const rows = await this.db.select().from(caseFiles).where(and(inArray(caseFiles.id, fileIds), eq(caseFiles.taskId, taskId), eq(caseFiles.itemKey, itemKey), eq(caseFiles.uploadedById, this.user.userId)));
    if (rows.length !== new Set(fileIds).size) throw new BadRequestError('Some files are not ready or do not belong to this request');
    return rows.map((r) => ({ fileId: r.id, name: r.name, contentType: r.contentType, size: r.size }));
  }
}
