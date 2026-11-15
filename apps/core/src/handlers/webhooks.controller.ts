import { Controller, Delete, Get, Inject, Param, Post, Put, Res, Scope } from '@nestjs/common';
import type { Context } from 'hono';
import { Require } from '../auth/access';
import { WebhooksService } from '../webhooks/webhooks.service';
import { type AppRequest, REQUEST_PROXY } from '../injector/tokens/request-proxy.token';
import { handle } from '../http/respond';

/** Outbound webhook subscriptions and their delivery log (docs/plans/04). */
@Controller({ path: '/webhooks', scope: Scope.REQUEST })
export class WebhooksHandler {
  constructor(
    @Inject(WebhooksService) private readonly webhooks: WebhooksService,
    @Inject(REQUEST_PROXY) private readonly request: AppRequest,
  ) { }

  @Require('webhooks:manage')
  @Get()
  list(@Res() ctx: Context) {
    return handle(ctx, () => this.webhooks.list(), 'Failed to list webhooks');
  }

  @Require('webhooks:manage')
  @Post()
  create(@Res() ctx: Context) {
    return handle(ctx, async () => this.webhooks.create(await this.request.json()), 'Failed to create the webhook', 201);
  }

  @Require('webhooks:manage')
  @Post('/deliveries/:deliveryId/resend')
  resend(@Param('deliveryId') deliveryId: string, @Res() ctx: Context) {
    return handle(ctx, () => this.webhooks.resend(deliveryId), 'Failed to resend', 202);
  }

  @Require('webhooks:manage')
  @Get('/:id')
  get(@Param('id') id: string, @Res() ctx: Context) {
    return handle(ctx, () => this.webhooks.get(id), 'Failed to load the webhook');
  }

  @Require('webhooks:manage')
  @Put('/:id')
  update(@Param('id') id: string, @Res() ctx: Context) {
    return handle(ctx, async () => this.webhooks.update(id, await this.request.json()), 'Failed to update the webhook');
  }

  @Require('webhooks:manage')
  @Delete('/:id')
  remove(@Param('id') id: string, @Res() ctx: Context) {
    return handle(ctx, () => this.webhooks.remove(id), 'Failed to delete the webhook', 204);
  }

  @Require('webhooks:manage')
  @Post('/:id/rotate-secret')
  rotate(@Param('id') id: string, @Res() ctx: Context) {
    return handle(ctx, () => this.webhooks.rotateSecret(id), 'Failed to rotate the secret');
  }

  @Require('webhooks:manage')
  @Post('/:id/test')
  test(@Param('id') id: string, @Res() ctx: Context) {
    return handle(ctx, () => this.webhooks.test(id), 'Failed to send the test event', 202);
  }

  @Require('webhooks:manage')
  @Get('/:id/deliveries')
  deliveries(@Param('id') id: string, @Res() ctx: Context) {
    return handle(ctx, () => this.webhooks.deliveries(id), 'Failed to list deliveries');
  }
}

/** The event catalogue (what can be subscribed to, with example payloads). */
@Controller({ path: '/webhook-events', scope: Scope.REQUEST })
export class WebhookEventsHandler {
  constructor(@Inject(WebhooksService) private readonly webhooks: WebhooksService) { }

  @Require('webhooks:manage')
  @Get()
  list(@Res() ctx: Context) {
    return handle(ctx, () => this.webhooks.eventTypes(), 'Failed to list events');
  }
}
