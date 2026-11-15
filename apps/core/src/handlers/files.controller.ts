import { Controller, Get, Inject, Param, Put, Res, Scope } from "@nestjs/common";
import { FilesService } from "../services/files.service";
import type { Context } from "hono";
import assert from "assert";
import { type AppRequest, REQUEST_PROXY } from "../injector/tokens/request-proxy.token";


@Controller({
  path: '/files',
  scope: Scope.REQUEST
})
export class FilesHandler {
  constructor(@Inject(FilesService) private filesService: FilesService, @Inject(REQUEST_PROXY) private readonly requestProxy: AppRequest) { }

  @Put()
  async putFile(@Res() ctx: Context) {
    const form = await this.requestProxy.formData();

    const file: File | null = form.get('file') as File | null;

    if (!file) { throw new Error('no file sent'); }

    await this.filesService.putFile(file, file.name);

    ctx.res = new Response(JSON.stringify({ success: true }));
    return;
  }

  @Get('/:objectId')
  async downloadFile(@Param('objectId') objectId: string, @Res() ctx: Context) {
    assert(objectId, 'object id is required');

    const rs = await this.filesService.downloadFile(objectId);

    ctx.res = new Response(new Blob([rs] as any));
    return;
  }
}