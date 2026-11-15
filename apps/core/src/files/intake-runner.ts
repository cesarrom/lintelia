import * as restate from '@restatedev/restate-sdk/fetch';
import type { IntakeReport } from '@repo/fintivio/entities/tenant';
import { INTERNAL_SIGNATURE_HEADER, verifyInternalSignature } from '../auth/internal-signature';
import type { AuditWriter } from '../services/audit.writer';
import { quarantineKey } from './object-store';
import { policyFor } from './policy';
import { sniffType, UnsanitizableError } from './intake';
import { sha256Hex, type FileStore } from './file-store';

/**
 * File intake (docs/plans/07), one durable execution per upload: size and hash checks → type sniffing against the
 * policy → malware scan → sanitisation (content disarm and reconstruction) → rescan → clean storage. Any failure
 * keeps the file out of the case: `rejected` with a reason the uploader sees; scanner/sanitiser outages are retried
 * a few times, then the upload is rejected as `processing_failed` (never made available unscanned).
 */
export function createIntakeRunner({ store, audit }: { store: FileStore; audit: AuditWriter }) {
  return restate.service({
    name: 'fileIntake',
    handlers: {
      process: async (ctx: restate.Context, input: { tenantId: string; uploadId: string }) => {
        const { tenantId, uploadId } = input;
        if (!verifyInternalSignature(ctx.request().headers.get(INTERNAL_SIGNATURE_HEADER), 'intake', tenantId, uploadId)) {
          throw new restate.TerminalError('Forbidden', { errorCode: 403 });
        }
        const actor = { type: 'system', email: 'file-intake' };
        const reject = async (reason: string, report: IntakeReport, label: string) => {
          await ctx.run(`reject-${label}`, async () => {
            const upload = await store.reject(tenantId, uploadId, reason, report);
            await audit.record(tenantId, actor, 'file.rejected', { type: 'upload', id: uploadId, name: upload?.declaredName }, { reason, scan: report.scan ?? null }, upload?.caseId);
          });
          return { status: 'rejected', reason };
        };

        // 1. What arrived matches what was declared and what the policy allows.
        const checked = await ctx.run('check', async () => {
          const upload = await store.upload(tenantId, uploadId);
          if (!upload || upload.status !== 'uploaded') return { skip: true as const };
          await store.updateUpload(tenantId, uploadId, { status: 'scanning' });
          const bytes = await store.objects.get(quarantineKey(tenantId, uploadId));
          if (!bytes) return { skip: false as const, error: 'the file did not arrive' };
          const policy = policyFor(upload.purpose, (upload.report as { item?: { accept?: string[]; maxSizeMb?: number } }).item);
          if (bytes.length > policy.maxBytes) return { skip: false as const, error: `the file is larger than ${Math.round(policy.maxBytes / 1024 / 1024)} MB` };
          if (bytes.length !== upload.declaredSize) return { skip: false as const, error: 'the file size does not match what was announced' };
          if (upload.declaredSha256 && sha256Hex(bytes) !== upload.declaredSha256) return { skip: false as const, error: 'the file was corrupted during upload' };
          const sniffed = await sniffType(bytes, upload.declaredType);
          if (!sniffed || !policy.types.includes(sniffed)) return { skip: false as const, error: `this type of file is not accepted${sniffed ? ` (${sniffed})` : ''}`, sniffed };
          return { skip: false as const, sniffed, ownerType: upload.ownerType, sanitize: policy.sanitize };
        });
        if (checked.skip) return { status: 'skipped' };
        if ('error' in checked && checked.error) return reject(checked.error, { sniffedType: checked.sniffed ?? null }, 'check');
        const contentType = checked.sniffed!;
        const report: IntakeReport = { sniffedType: contentType };

        // 2. Malware scan of the original.
        let scan;
        try {
          scan = await ctx.run('scan', async () => store.scanner.scan((await store.objects.get(quarantineKey(tenantId, uploadId)))!), { maxRetryAttempts: 3 });
        } catch {
          return reject('processing_failed', { ...report, scan: { result: 'error' } }, 'scan-error');
        }
        report.scan = scan;
        if (scan.result === 'infected') return reject('malware detected', report, 'infected');

        // 3. Sanitise (content disarm and reconstruction), then 4. rescan what will be stored. Documents from trusted
        // connectors that must stay byte-identical (signed PDFs) skip sanitisation; they were scanned above.
        const sanitizedKey = `${quarantineKey(tenantId, uploadId)}.sanitized`;
        if (checked.sanitize) {
          let sanitized: { actions: string[]; engine: string | null; size: number };
          try {
            sanitized = await ctx.run('sanitize', async () => {
              const bytes = (await store.objects.get(quarantineKey(tenantId, uploadId)))!;
              try {
                const result = await store.sanitizer.sanitize(bytes, contentType);
                await store.objects.put(sanitizedKey, result.content);
                return { actions: result.actions, engine: result.engine ?? null, size: result.content.length };
              } catch (error) {
                if (error instanceof UnsanitizableError) throw new restate.TerminalError(`unsanitizable: ${error.message}`);
                throw error;
              }
            }, { maxRetryAttempts: 3 });
          } catch (error) {
            // The file itself cannot be made safe → its own reason; the sanitiser being unavailable (retries exhausted) →
            // processing_failed, so the client simply uploads again later.
            const message = (error as Error).message ?? '';
            const reason = message.startsWith('unsanitizable: ') ? `the file could not be made safe: ${message.slice('unsanitizable: '.length)}` : 'processing_failed';
            return reject(reason, report, 'sanitize-error');
          }
          report.sanitization = { actions: sanitized.actions, engine: sanitized.engine };

          let rescan;
          try {
            rescan = await ctx.run('rescan', async () => store.scanner.scan((await store.objects.get(sanitizedKey))!), { maxRetryAttempts: 3 });
          } catch {
            return reject('processing_failed', { ...report, rescan: { result: 'error' } }, 'rescan-error');
          }
          report.rescan = rescan;
          if (rescan.result === 'infected') return reject('malware detected', report, 'rescan-infected');
        } else {
          report.sanitization = { actions: ['kept byte-identical (trusted source, signatures preserved)'], engine: null };
        }

        // 5. Clean storage: the case file exists from now on.
        const fileId = await ctx.run('accept', async () => {
          const upload = (await store.upload(tenantId, uploadId))!;
          const content = (await store.objects.get(checked.sanitize ? sanitizedKey : quarantineKey(tenantId, uploadId)))!;
          const file = await store.accept(tenantId, uploadId, content, contentType, report, null);
          await store.objects.delete(sanitizedKey).catch(() => undefined);
          await audit.record(tenantId, actor, 'file.accepted', { type: 'file', id: file.id, name: file.name },
            { uploadId, contentType, size: file.size, sanitization: report.sanitization?.actions ?? [] }, upload.caseId);
          return file.id;
        });
        return { status: 'available', fileId };
      },
    },
  });
}
