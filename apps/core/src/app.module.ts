import { Module } from '@nestjs/common';
import { AUTH_PROVIDER } from './injector/tokens/auth.token';
import { ENV_PROVIDER } from './injector/tokens/env.token';
import { GLOBAL_CONNECTION_PROVIDER } from './injector/tokens/global-connection.token';
import { TENANT_PROVIDER } from './injector/tokens/tenant.token';
import { TENANT_CONNECTION_PROVIDER } from './injector/tokens/tenant-connection.token';
import { USER_PROVIDER } from './injector/tokens/user.token';

import { DatabaseService } from "./services/database.service";
import { DomainsService } from "./services/domains.service";
import { EmailTemplatesService } from "./services/email-templates.service";
import { EmailsService } from "./services/emails.service";
import { EnvironmentsService } from "./services/environments.service";
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
import { ConnectionService } from "./services/connection.service";

import { WorkflowService } from "./services/restate/workflow";
import { SchedulerService } from "./services/restate/scheduler";
import { ConditionalService } from "./services/restate/conditional";
import { DecisionTableService } from "./services/restate/decision-table";
import { DocumentExtractorService } from "./services/restate/document-extractor";
import { IteratorService } from "./services/restate/iterator";
import { MapperService } from "./services/restate/mapper";
import { DatabaseService as DatabaseServiceRestate } from "./services/restate/database";
import { FormService } from "./services/restate/form";
import { IdentityValidationService } from "./services/restate/identity-validation";
import { ApiService } from "./services/restate/api";
import { ProofOfLifeService } from "./services/restate/proof-of-life";
import { WizardService } from "./services/restate/wizard";
import { EmailService } from "./services/restate/email";
import { EndService } from "./services/restate/end";
import { LogService } from "./services/restate/logs";
import { ReviewService } from "./services/restate/reviews";
import { RoleService } from "./services/restate/roles";
import { UserService } from "./services/restate/users";
import { SystemService } from "./services/restate/system";
import { TenantService } from "./services/restate/tenant";
import { AuthService } from "./services/restate/auth";

import { AuthHandler } from './handlers/auth.controller';
import { DatabaseHandler } from './handlers/database.controller';
import { FormHandler } from './handlers/form.controller';
import { LogHandler } from './handlers/logs.controller';
import { ProofOfLifeHandler } from './handlers/proof-of-life.controller';
import { ReviewHandler } from './handlers/reviews.controller';
import { RoleHandler } from './handlers/roles.controller';
import { SystemHandler } from './handlers/system.controller';
import { TenantHandler } from './handlers/tenant.controller';
import { UserHandler } from './handlers/users.controller';
import { DocusealHanlder } from './handlers/docuseal.controller';
import { WorkflowHandler } from './handlers/workflow.controller';
import { RestateHandler } from './handlers/restate.controller';
import { REQUEST_PROXY_PROVIDER } from './injector/tokens/request-proxy.token';

const RESTATE_SERVICES = [
  WorkflowService,
  SchedulerService,
  ConditionalService,
  DecisionTableService,
  DocumentExtractorService,
  IteratorService,
  MapperService,
  DatabaseServiceRestate,
  FormService,
  IdentityValidationService,
  ApiService,
  ProofOfLifeService,
  WizardService,
  EmailService,
  EndService,
  LogService,
  ReviewService,
  RoleService,
  UserService,
  SystemService,
  TenantService,
  AuthService,
];

const SERVICES = [
  DatabaseService,
  DomainsService,
  EmailTemplatesService,
  EmailsService,
  EnvironmentsService,
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
  ConnectionService,
];

const HANDLERS = [
  AuthHandler,
  DatabaseHandler,
  FormHandler,
  LogHandler,
  ProofOfLifeHandler,
  ReviewHandler,
  RoleHandler,
  SystemHandler,
  TenantHandler,
  UserHandler,
  WorkflowHandler,
  RestateHandler,
  DocusealHanlder,
];

export const HANDLERS_MAP = {
  auth: AuthHandler,
  databases: DatabaseHandler,
  forms: FormHandler,
  logs: LogHandler,
  proofOfLife: ProofOfLifeHandler,
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
    GLOBAL_CONNECTION_PROVIDER,
    TENANT_CONNECTION_PROVIDER,
    TENANT_PROVIDER,
    USER_PROVIDER,
    AUTH_PROVIDER,
    REQUEST_PROXY_PROVIDER,
    ...SERVICES,
    ...RESTATE_SERVICES,
  ],
})
export class AppModule { }

