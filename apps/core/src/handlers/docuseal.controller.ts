import jwt from 'jsonwebtoken';
import { Scope, Inject, Controller, Res, Put, Get, Post } from "@nestjs/common";
import type { Context } from "hono";
import type { User, Tenant, DocusealTokenRequest, DocumentTemplate } from "@repo/fintivio/schemas";
import { USER } from "../injector/tokens/user.token";
import { TENANT } from "../injector/tokens/tenant.token";
import { type AppRequest, REQUEST_PROXY } from "../injector/tokens/request-proxy.token";
import { ENV } from "../injector/tokens/env.token";
import type { AppEnvironment } from '../constants';
import { TENANT_CONNECTION } from '../injector/tokens/tenant-connection.token';
import type { TenantDatabase } from '../clients/database.client';
import { PDFDocument } from 'pdf-lib'
import { sysDocumentTemplates } from '../entities/tenants';

@Controller({
  path: '/docuseal',
  scope: Scope.REQUEST
})
export class DocusealHanlder {
  constructor(
    @Inject(REQUEST_PROXY) protected readonly requestProxy: AppRequest,
    @Inject(ENV) protected readonly env: AppEnvironment,
    @Inject(TENANT_CONNECTION) protected readonly db: TenantDatabase,
    @Inject(USER) protected readonly user?: User,
    @Inject(TENANT) protected readonly tenant?: Tenant,
  ) { }

  @Put('/token')
  async getToken(@Res() ctx: Context): Promise<void> {
    console.log(this.requestProxy);
    const request = await this.requestProxy.json() as DocusealTokenRequest;

    const token = jwt.sign({
      user_email: this.env.DOCUSEAL_EMAIL,
      integration_email: 'signer@example.com',
      ...request,
    }, this.env.DOCUSEAL_TOKEN);

    ctx.res = new Response(JSON.stringify({ token }), { status: 200 });
    return;
  }

  @Post('/document-templates')
  async createDocumentTemplate(@Res() ctx: Context): Promise<void> {
    const { documentUrl, name, description } = await this.requestProxy.json() as DocumentTemplate;
    const pdfDoc = await PDFDocument.load(await fetch(documentUrl).then(res => res.arrayBuffer()));
    
    const variables = pdfDoc.getForm().getFields().map(field => {
      return {
        type: field.constructor.name,
        name: field.getName(),
        fullyQualifiedName: field.acroField.getFullyQualifiedName(),
        ...field.acroField.getWidgets()[0].getRectangle()
      }
    });

    const documentTemplate = {
      name,
      description,
      documentUrl,
      variables: variables as any,
      createdBy: this.user?.email || 'system',
    } as DocumentTemplate;

    await this.db.insert(sysDocumentTemplates).values(documentTemplate);

    ctx.res = new Response(JSON.stringify({ variables }), { status: 200 });
    return;
  }

  @Get('/document-templates')
  async getDocumentTemplates(@Res() ctx: Context): Promise<void> {
    const documentTemplates = await this.db.select().from(sysDocumentTemplates);
    ctx.res = new Response(JSON.stringify(documentTemplates), { status: 200 });
    return;
  }


}
