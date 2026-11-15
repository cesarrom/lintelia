import * as restate from "@restatedev/restate-sdk/fetch";
import { All, Controller, Inject, Req, Res, type OnModuleInit } from '@nestjs/common';
import { ModuleRef } from "@nestjs/core";
import type { Context } from "hono";
import type { HonoRequest } from "hono/request";
import { Public } from "../auth/access";
import { env } from "../constants";
import { createCaseRunner } from "../engine/case-runner";
import { CASE_REPOSITORY } from "../engine/engine.client";
import { NOTIFIER } from "../engine/providers";
import { AuditWriter, setEventSink } from "../services/audit.writer";
import { TenantDirectory } from "../services/tenant-directory.service";
import { ConnectorRegistry } from "../integrations/registry";
import { ConnectorInvoker } from "../integrations/connector-invoker";
import { connectorComponentResolver } from "../integrations/connector-components";
import { registerComponentResolver } from "../engine/components";
import { ChildCases } from "../engine/child-cases";
import { WebhookStore } from "../webhooks/webhook-store";
import { createWebhookRunner } from "../webhooks/webhook-runner";
import { FileStore } from "../files/file-store";
import { createIntakeRunner } from "../files/intake-runner";

/**
 * Restate deployment endpoint (`/restate`), registered with the Restate server. It serves the durable parts of the
 * platform, all driven by the API with signed calls (`x-fintivio-signature`), never by end users:
 *  - `caseRun`: the case engine (one workflow per case);
 *  - `webhooks`: outbound webhook dispatch and deliveries;
 *  - `fileIntake`: the upload intake pipeline.
 * The legacy node engine (services/restate/*, driven through the ingress with user tokens in its payloads) was
 * removed (docs/architecture/identity.md §Durable workflow identity).
 *
 * The HTTP route itself is public: only the Restate server should reach it. In deployed environments configure
 * RESTATE_IDENTITY_KEYS so request signatures are verified, and keep the Restate ingress private.
 */
@Public()
@Controller({ path: '/restate' })
export class RestateHandler implements OnModuleInit {
  private fetchHandler!: (req: Request) => Promise<Response>;

  constructor(@Inject(ModuleRef) private readonly moduleRef: ModuleRef) { }

  async onModuleInit() {
    const endpoint = restate.endpoint();
    if (env.RESTATE_IDENTITY_KEYS.length) {
      endpoint.withIdentityV1(...env.RESTATE_IDENTITY_KEYS);
    }
    const get = <T>(token: unknown) => this.moduleRef.get<T>(token as never, { strict: false });
    const audit = get<AuditWriter>(AuditWriter);
    const directory = get<TenantDirectory>(TenantDirectory);

    // The case engine: its handlers are ingress-public but verify the API's signature (see createCaseRunner).
    const registry = get<ConnectorRegistry>(ConnectorRegistry);
    const invoker = get<ConnectorInvoker>(ConnectorInvoker);
    const childCases = get<ChildCases>(ChildCases);
    registerComponentResolver(connectorComponentResolver((id) => registry.manifest(id)));
    endpoint.bind(createCaseRunner({
      repository: get(CASE_REPOSITORY),
      audit,
      notifier: get(NOTIFIER),
      directory,
      services: {
        invokeConnector: (input) => invoker.invoke(input),
        startChildCase: (input) => childCases.start(input),
        notifyParent: (tenantId, childCaseId, signal) => childCases.notifyParent(tenantId, childCaseId, signal),
      },
    }));

    // Outbound webhooks: the durable dispatcher, fed by the audit writer's outbox events.
    const webhookStore = get<WebhookStore>(WebhookStore);
    endpoint.bind(createWebhookRunner({ store: webhookStore, audit, notifier: get(NOTIFIER), loadTenant: (tenantId) => directory.findById(tenantId) }));
    setEventSink((tenantId, eventId) => webhookStore.dispatch(tenantId, eventId));

    // File intake (scan → sanitise → rescan) for uploads.
    endpoint.bind(createIntakeRunner({ store: get<FileStore>(FileStore), audit }));

    this.fetchHandler = endpoint.handler().fetch;
  }

  @All('/*')
  async any(@Req() req: HonoRequest, @Res() ctx: Context) {
    ctx.res = await this.fetchHandler(req.raw);
  }
}
