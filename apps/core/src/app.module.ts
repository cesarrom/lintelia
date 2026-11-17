import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ENV_PROVIDER } from './injector/tokens/env.token';
import { DATABASES_PROVIDER, DatabasesLifecycle } from './injector/tokens/databases.token';
import { PLATFORM_CONNECTION_PROVIDER } from './injector/tokens/platform-connection.token';
import { AUTH_CONTEXT_PROVIDER } from './injector/tokens/auth-context.token';
import { TENANT_PROVIDER } from './injector/tokens/tenant.token';
import { TENANT_CONNECTION_PROVIDER } from './injector/tokens/tenant-connection.token';
import { USER_PROVIDER } from './injector/tokens/user.token';
import { EMAIL_PROVIDER_FACTORY } from './providers/email.provider';
import { STORAGE_PROVIDER_FACTORY } from './providers/storage.provider';
import { IdentityService } from './auth/identity.service';
import { AccessGuard } from './auth/access';
import { TenantDirectory } from './services/tenant-directory.service';

import { DatabaseService } from "./services/database.service";
import { DomainsService } from "./services/domains.service";
import { EmailTemplatesService } from "./services/email-templates.service";
import { EmailsService } from "./services/emails.service";
import { FilesService } from "./services/files.service";
import { FormsService } from "./services/forms.service";
import { InvitationsService } from "./services/invitations.service";
import { KeyValueService } from "./services/key-value.service";
import { LogsService } from "./services/logs.service";
import { ReviewsService } from "./services/reviews.service";
import { RolesService } from "./services/roles.service";
import { SystemTriggersService } from "./services/system-triggers.service";
import { SystemVariablesService } from "./services/system-variables.service";
import { TenantsService } from "./services/tenants.service";
import { UsersService } from "./services/users.service";
import { WebService } from "./services/web.service";
import { WorkflowExecutionsService } from "./services/workflow-executions.service";
import { WorkflowsService } from "./services/workflows.service";


import { AuthHandler } from './handlers/auth.controller';
import { DatabaseHandler } from './handlers/database.controller';
import { FormHandler } from './handlers/form.controller';
import { LogHandler } from './handlers/logs.controller';
import { ReviewHandler } from './handlers/reviews.controller';
import { RoleHandler } from './handlers/roles.controller';
import { SystemHandler } from './handlers/system.controller';
import { TenantHandler } from './handlers/tenant.controller';
import { UserHandler } from './handlers/users.controller';
import { WorkflowHandler } from './handlers/workflow.controller';
import { FilesHandler } from './handlers/files.controller';
import { HealthHandler } from './handlers/health.controller';
import { CatalogHandler } from './handlers/catalog.controller';
import { AuditHandler } from './handlers/audit.controller';
import { AuditWriter } from './services/audit.writer';
import { SystemRolesSync } from './services/system-roles.sync';
import { ENGINE_PROVIDERS } from './engine/providers';
import { RestateHandler } from './handlers/restate.controller';
import { CaseHooksHandler, CasesHandler } from './handlers/cases.controller';
import { TasksHandler } from './handlers/tasks.controller';
import { ClientsHandler } from './handlers/clients.controller';
import { PortalHandler } from './handlers/portal.controller';
import { PublicFormsHandler } from './handlers/public.controller';
import { WorkflowTemplatesHandler } from './handlers/workflow-templates.controller';
import { CasesService } from './services/cases.service';
import { TasksService, ClientTasksService } from './services/tasks.service';
import { WorkflowLifecycleService } from './services/workflow-lifecycle.service';
import { SignalsService } from './services/signals.service';
import { PublicFormsService } from './services/public-forms.service';
import { EventsService } from './services/events.service';
import { ClientsService } from './services/clients.service';
import { DataRequestsService } from './services/data-requests.service';
import { PlatformStaffService } from './services/platform-staff.service';
import { SupportAccessService } from './services/support-access.service';
import { PlatformAuditWriter } from './services/platform-audit.writer';
import { PlatformHandler, SupportAccessHandler } from './handlers/platform.controller';
import { WorkflowComponentsHandler } from './handlers/workflow-components.controller';
import { ConnectorComponentsService } from './integrations/connector-components.service';
import { ConnectorRegistry } from './integrations/registry';
import { ConnectorInvoker } from './integrations/connector-invoker';
import { ConnectorApiService } from './integrations/connector-api.service';
import { InstallationsService } from './integrations/installations.service';
import { ChildCases } from './engine/child-cases';
import { IntegrationsHandler } from './handlers/integrations.controller';
import { ConnectorApiHandler, WellKnownHandler } from './handlers/connector-api.controller';
import { DataRequestsHandler, MyDataRequestsHandler } from './handlers/data-requests.controller';
import { ApiClientsHandler, OAuthHandler } from './handlers/api-clients.controller';
import { ApiClientsService } from './api-clients/api-clients.service';
import { WebhooksHandler, WebhookEventsHandler } from './handlers/webhooks.controller';
import { WebhooksService } from './webhooks/webhooks.service';
import { WebhookStore } from './webhooks/webhook-store';
import { EventsHandler } from './handlers/events.controller';
import { UploadsHandler, UploadTargetHandler, BlobsHandler, CaseFilesHandler } from './handlers/uploads.controller';
import { UploadsService } from './files/uploads.service';
import { FileStore } from './files/file-store';
import { SecurityHandler } from './handlers/security.controller';
import { SsoHandler, SsoAuthHandler, PlatformSsoHandler } from './handlers/sso.controller';
import { SsoService } from './auth/sso/sso.service';
import { SSO_BROKER, WorkOsSsoBroker } from './auth/sso/broker';
import { DirectorySync } from './auth/sso/directory-sync';
import { PartiesService } from './services/parties.service';
import { DomainsHandler } from './handlers/domains.controller';
import { CustomDomainsService } from './services/custom-domains.service';
import { REQUEST_PROXY_PROVIDER } from './injector/tokens/request-proxy.token';
import { ClientAppsHandler, ClientAuthHandler, ClientDataHandler, ClientRuntimeHandler, ClientSessionsHandler } from './handlers/client-apps.controller';
import { ClientAppsService } from './client-apps/studio.service';
import { ExperienceMapService } from './experience-map/map.service';
import { ExperienceMapHandler } from './handlers/experience-map.controller';
import { ClientRuntimeService } from './client-apps/runtime.service';
import { ClientProvisioningService } from './client-apps/provisioning.service';

const SERVICES = [
  DatabaseService,
  DomainsService,
  EmailTemplatesService,
  EmailsService,
  FilesService,
  FormsService,
  InvitationsService,
  KeyValueService,
  LogsService,
  ReviewsService,
  RolesService,
  SystemTriggersService,
  SystemVariablesService,
  TenantsService,
  UsersService,
  WebService,
  WorkflowExecutionsService,
  WorkflowsService,
  CasesService,
  TasksService,
  ClientTasksService,
  WorkflowLifecycleService,
  SignalsService,
  PublicFormsService,
  EventsService,
  ClientsService,
  DataRequestsService,
  PlatformStaffService,
  SupportAccessService,
  ConnectorComponentsService,
  InstallationsService,
  ApiClientsService,
  WebhooksService,
  UploadsService,
  PartiesService,
  CustomDomainsService,
  ClientAppsService,
  ExperienceMapService,
  ClientRuntimeService,
  ClientProvisioningService,
];

const HANDLERS = [
  AuthHandler,
  DatabaseHandler,
  FormHandler,
  LogHandler,
  ReviewHandler,
  RoleHandler,
  SystemHandler,
  TenantHandler,
  UserHandler,
  WorkflowHandler,
  RestateHandler,
  FilesHandler,
  HealthHandler,
  CatalogHandler,
  AuditHandler,
  CasesHandler,
  CaseHooksHandler,
  TasksHandler,
  ClientsHandler,
  PortalHandler,
  PublicFormsHandler,
  WorkflowTemplatesHandler,
  DataRequestsHandler,
  MyDataRequestsHandler,
  PlatformHandler,
  SupportAccessHandler,
  WorkflowComponentsHandler,
  IntegrationsHandler,
  ConnectorApiHandler,
  WellKnownHandler,
  ApiClientsHandler,
  OAuthHandler,
  WebhooksHandler,
  WebhookEventsHandler,
  EventsHandler,
  UploadsHandler,
  UploadTargetHandler,
  BlobsHandler,
  CaseFilesHandler,
  SecurityHandler,
  SsoHandler,
  SsoAuthHandler,
  PlatformSsoHandler,
  DomainsHandler,
  ClientAppsHandler,
  ExperienceMapHandler,
  ClientRuntimeHandler,
  ClientDataHandler,
  ClientSessionsHandler,
  ClientAuthHandler,
];

export const HANDLERS_MAP = {
  auth: AuthHandler,
  databases: DatabaseHandler,
  forms: FormHandler,
  logs: LogHandler,
  reviews: ReviewHandler,
  roles: RoleHandler,
  system: SystemHandler,
  tenants: TenantHandler,
  users: UserHandler,
  workflows: WorkflowHandler,
};

@Module({
  controllers: [...HANDLERS],
  providers: [
    ENV_PROVIDER,
    DATABASES_PROVIDER,
    DatabasesLifecycle,
    PLATFORM_CONNECTION_PROVIDER,
    EMAIL_PROVIDER_FACTORY,
    STORAGE_PROVIDER_FACTORY,
    TenantDirectory,
    AuditWriter,
    PlatformAuditWriter,
    ConnectorRegistry,
    ConnectorInvoker,
    ConnectorApiService,
    ChildCases,
    WebhookStore,
    FileStore,
    IdentityService,
    { provide: SSO_BROKER, useClass: WorkOsSsoBroker },
    SsoService,
    DirectorySync,
    SystemRolesSync,
    ...ENGINE_PROVIDERS,
    { provide: APP_GUARD, useClass: AccessGuard },
    // request-scoped context
    REQUEST_PROXY_PROVIDER,
    AUTH_CONTEXT_PROVIDER,
    TENANT_PROVIDER,
    TENANT_CONNECTION_PROVIDER,
    USER_PROVIDER,
    ...SERVICES,
  ],
})
export class AppModule { }
