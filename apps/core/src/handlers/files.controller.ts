import { Controller, Get, Inject, Put, Req, Res, Scope } from "@nestjs/common";
import type { Context } from "hono";
import type { HonoRequest } from "hono/request";
import { FilesService } from "../services/files.service";
import { Access } from "../auth/access";
import { type AppRequest, REQUEST_PROXY } from "../injector/tokens/request-proxy.token";
import { json, jsonError } from "../http/respond";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/** File uploads/downloads (`/object`, the path the web app uses). Objects are scoped to the caller's tenant. */
@Access('member', 'client', 'staff')
@Controller({
  path: '/object',
  scope: Scope.REQUEST
})
export class FilesHandler {
  constructor(@Inject(FilesService) private filesService: FilesService, @Inject(REQUEST_PROXY) private readonly requestProxy: AppRequest) { }

  /** Multipart upload with a `file` field. Responds with the generated object key to store and fetch later. */
  @Put()
  async putFile(@Res() ctx: Context) {
    try {
      const form = await this.requestProxy.formData();
      const file = form.get('file');
      if (!(file instanceof File)) return json(ctx, { error: 'no file sent' }, 400);
      if (file.size > MAX_UPLOAD_BYTES) return json(ctx, { error: 'file too large' }, 413);

      const key = this.filesService.newUploadKey(file.name);
      await this.filesService.putFile(file, key);
      json(ctx, { success: true, key }, 201);
    } catch (error) {
      jsonError(ctx, error, 'Upload failed');
    }
  }

  /** GET /object/<key> (keys contain slashes). */
  @Get('/*')
  async downloadFile(@Req() req: HonoRequest, @Res() ctx: Context) {
    try {
      const key = decodeURIComponent(new URL(req.url).pathname.replace(/^\/object\//, ''));
      const object = await this.filesService.getObject(key);
      if (!object) return json(ctx, { error: 'not found' }, 404);
      ctx.res = new Response(new Uint8Array(object.body), {
        headers: { 'Content-Type': object.contentType, 'Cache-Control': 'private, max-age=300' },
      });
    } catch (error) {
      jsonError(ctx, error, 'Download failed', 400);
    }
  }
}
