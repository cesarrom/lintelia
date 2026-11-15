import { Controller, Get, Inject, Param, Post, Put, Req, Res, Scope } from '@nestjs/common';
import type { Context } from 'hono';
import type { HonoRequest } from 'hono/request';
import { Access, Public } from '../auth/access';
import { UploadsService } from '../files/uploads.service';
import { FileStore } from '../files/file-store';
import { quarantineKey, verifyToken } from '../files/object-store';
import { type AppRequest, REQUEST_PROXY } from '../injector/tokens/request-proxy.token';
import { handle, json } from '../http/respond';

/** Read a request body up to `limit` bytes (streams: an oversized upload is cut off, not buffered). */
async function readLimited(req: HonoRequest, limit: number): Promise<Uint8Array | null> {
  const declared = Number(req.header('content-length') ?? NaN);
  if (Number.isFinite(declared) && declared > limit) return null;
  const reader = req.raw.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** Uploads (docs/plans/07): intent → bytes to the signed URL → complete → durable intake (scan, sanitise). */
@Controller({ path: '/uploads', scope: Scope.REQUEST })
export class UploadsHandler {
  constructor(
    @Inject(UploadsService) private readonly uploads: UploadsService,
    @Inject(REQUEST_PROXY) private readonly request: AppRequest,
  ) { }

  /** `{ purpose, taskId, itemKey | caseId, name, size, type, sha256? }` → the upload and where to PUT the bytes. */
  @Access('client', 'member')
  @Post()
  create(@Res() ctx: Context) {
    return handle(ctx, async () => this.uploads.createIntent(await this.request.json()), 'Failed to start the upload', 201);
  }

  @Access('client', 'member')
  @Post('/:uploadId/complete')
  complete(@Param('uploadId') uploadId: string, @Res() ctx: Context) {
    return handle(ctx, () => this.uploads.complete(uploadId), 'Failed to complete the upload', 202);
  }

  @Access('client', 'member')
  @Get('/:uploadId')
  status(@Param('uploadId') uploadId: string, @Res() ctx: Context) {
    return handle(ctx, () => this.uploads.status(uploadId), 'Failed to load the upload');
  }
}

/**
 * The signed upload target (what a presigned object-store URL is in the cloud): authorised by its token only, bytes
 * go to quarantine, never anywhere usable.
 */
@Public()
@Controller({ path: '/uploads', scope: Scope.REQUEST })
export class UploadTargetHandler {
  constructor(@Inject(FileStore) private readonly store: FileStore) { }

  @Put('/:uploadId/content')
  async content(@Param('uploadId') uploadId: string, @Req() req: HonoRequest, @Res() ctx: Context) {
    const token = verifyToken<{ t: string; u: string; s: number }>(new URL(req.url).searchParams.get('token'));
    if (!token || token.u !== uploadId) return json(ctx, { error: 'This upload link is invalid or expired' }, 403);
    const upload = await this.store.upload(token.t, uploadId);
    if (!upload || upload.status !== 'pending') return json(ctx, { error: 'This upload is closed' }, 409);
    const bytes = await readLimited(req, token.s);
    if (!bytes) return json(ctx, { error: 'The file is larger than announced' }, 413);
    await this.store.objects.put(quarantineKey(token.t, uploadId), bytes);
    json(ctx, { received: bytes.length }, 201);
  }
}

/** Signed download URLs (≤ 60 s), always served as attachments with a restrictive content security policy. */
@Public()
@Controller({ path: '/blobs', scope: Scope.REQUEST })
export class BlobsHandler {
  constructor(@Inject(FileStore) private readonly store: FileStore) { }

  @Get('/:token')
  async get(@Param('token') token: string, @Res() ctx: Context) {
    const claims = verifyToken<{ t: string; k: string; n: string; c: string }>(token);
    if (!claims) return json(ctx, { error: 'This link expired' }, 403);
    const bytes = await this.store.objects.get(claims.k);
    if (!bytes) return json(ctx, { error: 'Not found' }, 404);
    ctx.res = new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': claims.c,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(claims.n)}`,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cache-Control': 'private, no-store',
      },
    });
  }
}

/** Files of cases (list, download links). */
@Controller({ path: '/case-files', scope: Scope.REQUEST })
export class CaseFilesHandler {
  constructor(@Inject(UploadsService) private readonly uploads: UploadsService) { }

  @Access('client', 'member')
  @Get('/of/:caseId')
  list(@Param('caseId') caseId: string, @Res() ctx: Context) {
    return handle(ctx, () => this.uploads.filesOfCase(caseId), 'Failed to list files');
  }

  @Access('client', 'member')
  @Post('/:fileId/download-url')
  download(@Param('fileId') fileId: string, @Res() ctx: Context) {
    return handle(ctx, () => this.uploads.downloadUrl(fileId), 'Failed to prepare the download');
  }
}
