import "reflect-metadata";
import { AUTH_TOKEN, DISTRIBUTION_ID_TOKEN, ENVIRONMENT_TOKEN, TENANT_TOKEN, GLOBAL_DB_TOKEN, TENANT_DB_TOKEN, DOMAIN_TOKEN } from "./tokens";
import { UsersService, InvitationsService, DomainsService, SystemVariablesService, EnvironmentsService, FilesService, FormsService, KYCService, WorkflowsService, WorkflowExecutionsService, TenantsService, RolesService, EmailsService, EmailTemplatesService, LogsService } from "../services";
import { container, DependencyContainer } from "tsyringe";
import { Resource } from "sst";
import { auth } from "../clients/auth.client";
import { env } from "../constants";
import { DatabaseService } from "../services/database.service";
import { EventsService } from "../services/events.service";
import assert from "assert";

const injectors: Record<string, DependencyContainer> = {};

const getEnvironmentInjector = () => {
  const envContainer = container.createChildContainer();
  envContainer.register(AUTH_TOKEN, { useValue: auth });
  envContainer.register(ENVIRONMENT_TOKEN, { useValue: env });
  envContainer.register(DatabaseService, DatabaseService);
  envContainer.register(EnvironmentsService, EnvironmentsService);

  return envContainer;
}

function createEnvironmentInjector() {
  const envContainer = container.createChildContainer();
  envContainer.register(AUTH_TOKEN, { useValue: auth });
  envContainer.register(ENVIRONMENT_TOKEN, { useValue: env });
  envContainer.register(DatabaseService, DatabaseService);
  envContainer.register(EnvironmentsService, EnvironmentsService);

  return envContainer;
}

async function createTenantsInjector() {
  const environmentInjector = getEnvironmentInjector();

  const childContainer = createEnvironmentInjector();

  const environmentService = environmentInjector.resolve(EnvironmentsService);

  const resultArn = Resource.App.stage === 'local' ? { distributionArn: ' / ' } : await environmentService.getCurrentEnvironment();

  assert(resultArn?.distributionArn, 'Distribution ARN is required');

  const { distributionArn } = resultArn;

  const distributionId = distributionArn.split("/").pop();

  childContainer.register(DISTRIBUTION_ID_TOKEN, { useValue: Resource.App.stage === 'local' ? '' : distributionId });
  childContainer.register(KYCService, KYCService);
  childContainer.register(DomainsService, DomainsService);
  childContainer.register(TenantsService, TenantsService);
  childContainer.register(FilesService, FilesService);
  const databaseService = childContainer.resolve(DatabaseService);
  const globalDb = await databaseService.getGlobalConnection();
  childContainer.register(GLOBAL_DB_TOKEN, { useValue: globalDb });

  return childContainer;
}

const defaultKey = '__default__';
export async function getInjector(domain?: string) {
  if (!domain) {
    if (injectors[defaultKey]) {
      return injectors[defaultKey];
    }

    injectors[defaultKey] = await createTenantsInjector();
    return injectors[defaultKey];
  }

  if (injectors[domain]) {
    return injectors[domain];
  }

  const baseInjector = await getInjector();

  const childContainer = await createTenantsInjector();

  const tenantsService = baseInjector.resolve(TenantsService);
  const tenant = await tenantsService.getByDomain(domain);
  const tenantsDb = await tenantsService.getPlatformDBClient(domain);

  childContainer.register(TENANT_TOKEN, { useValue: tenant });
  childContainer.register(DOMAIN_TOKEN, { useValue: domain });
  childContainer.register(TENANT_DB_TOKEN, { useValue: tenantsDb });
  childContainer.register(LogsService, LogsService);
  childContainer.register(FormsService, FormsService);
  childContainer.register(WorkflowsService, WorkflowsService);
  childContainer.register(WorkflowExecutionsService, WorkflowExecutionsService);
  childContainer.register(RolesService, RolesService);
  childContainer.register(InvitationsService, InvitationsService);
  childContainer.register(EmailTemplatesService, EmailTemplatesService);
  childContainer.register(EmailsService, EmailsService);
  childContainer.register(EventsService, EventsService);
  childContainer.register(UsersService, UsersService);
  childContainer.register(SystemVariablesService, SystemVariablesService);

  injectors[domain] = childContainer;
  return injectors[domain];
}




