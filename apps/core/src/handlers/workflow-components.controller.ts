import { Controller, Get, Inject, Post, Res, Scope } from '@nestjs/common';
import type { Context } from 'hono';
import { Require } from '../auth/access';
import { builtinDefinitions } from '../engine/components';
import { evaluate, interpolate } from '../engine/expressions';
import { ConnectorComponentsService } from '../integrations/connector-components.service';
import { type AppRequest, REQUEST_PROXY } from '../injector/tokens/request-proxy.token';
import { handle } from '../http/respond';
import { BadRequestError } from '../http/errors';

/** The component catalogue for the workflow editor (docs/plans/01) and a side-effect-free expression tester. */
@Controller({ path: '/workflow-components', scope: Scope.REQUEST })
export class WorkflowComponentsHandler {
  constructor(
    @Inject(ConnectorComponentsService) private readonly connectorComponents: ConnectorComponentsService,
    @Inject(REQUEST_PROXY) private readonly request: AppRequest,
  ) { }

  /** Built-in components plus the components of the institution's active connections. */
  @Require('workflows:read')
  @Get()
  list(@Res() ctx: Context) {
    return handle(ctx, async () => [...builtinDefinitions(), ...(await this.connectorComponents.definitionsForTenant())], 'Failed to list components');
  }

  /** Evaluate a JSONata expression (`=…`) or a `{{template}}` against sample data. */
  @Require('workflows:manage')
  @Post('/evaluate')
  evaluate(@Res() ctx: Context) {
    return handle(ctx, async () => {
      const { expression, data } = await this.request.json<{ expression?: string; data?: Record<string, unknown> }>();
      if (typeof expression !== 'string') throw new BadRequestError('expression is required');
      try {
        const trimmed = expression.trim();
        const result = trimmed.startsWith('=') || !trimmed.includes('{{') ? await evaluate(trimmed, data ?? {}) : interpolate(trimmed, data ?? {});
        return { ok: true, result: result === undefined ? null : result };
      } catch (error) {
        return { ok: false, error: (error as Error).message };
      }
    }, 'Failed to evaluate');
  }
}
