import { Controller, Get, Inject, Param, Post, Res, Scope } from '@nestjs/common';
import type { Context } from 'hono';
import { Public } from '../auth/access';
import { PublicFormsService } from '../services/public-forms.service';
import { type AppRequest, REQUEST_PROXY } from '../injector/tokens/request-proxy.token';
import { clientIp, handle } from '../http/respond';

/**
 * Anonymous endpoints behind embedded forms. The public key identifies tenant + form; the embedding site's origin
 * (`X-Embed-Origin`) must be allowed by the publication. Submissions are rate limited and only start a workflow once
 * the applicant confirms their e-mail with a one-time code.
 */
@Public()
@Controller({ path: '/public/forms', scope: Scope.REQUEST })
export class PublicFormsHandler {
  constructor(
    @Inject(PublicFormsService) private readonly forms: PublicFormsService,
    @Inject(REQUEST_PROXY) private readonly request: AppRequest,
  ) { }

  /**
   * The site showing the form: `X-Embed-Origin` when the hosted form runs in an iframe (the browser's `Origin` is
   * then the institution's own host), otherwise the calling page's `Origin` (a site calling the API directly).
   */
  private get embedOrigin() {
    return this.request.headers.get('x-embed-origin') ?? this.request.headers.get('origin');
  }

  @Get('/:publicKey')
  get(@Param('publicKey') publicKey: string, @Res() ctx: Context) {
    return handle(ctx, () => this.forms.getPublic(publicKey, this.embedOrigin), 'Form not available');
  }

  /** Origins allowed to frame the hosted form (used by the web server to emit CSP `frame-ancestors`). */
  @Get('/:publicKey/embed-policy')
  policy(@Param('publicKey') publicKey: string, @Res() ctx: Context) {
    return handle(ctx, () => this.forms.embedPolicy(publicKey), 'Form not available');
  }

  @Post('/:publicKey/submissions')
  submit(@Param('publicKey') publicKey: string, @Res() ctx: Context) {
    return handle(ctx, async () => this.forms.submit(publicKey, await this.request.json(), {
      ip: clientIp(this.request.headers),
      embedOrigin: this.embedOrigin,
    }), 'Submission failed', 202);
  }

  @Post('/:publicKey/verify')
  verify(@Param('publicKey') publicKey: string, @Res() ctx: Context) {
    return handle(ctx, async () => {
      const { session, tenant, caseId, reference } = await this.forms.verify(publicKey, await this.request.json());
      return {
        ...session,
        tenant: { id: tenant.id, domain: tenant.domain, name: tenant.name, logoUrl: tenant.logoUrl, pallette: tenant.pallette },
        caseId,
        reference,
      };
    }, 'Verification failed');
  }
}
