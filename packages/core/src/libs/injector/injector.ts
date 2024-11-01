import { AUTH_TOKEN, DISTRIBUTION_ID_TOKEN, ENVIRONMENT_TOKEN, PLATFORM_DB_TOKEN, TENANT_TOKEN, TENANTS_DB_TOKEN } from "./tokens";
import { tenantsDB } from "../../models/tenants.sql";
import { ApplicationsService, DomainsService, EnvironmentsService, FilesService, FormsService, KYCService, ReviewsService, TenantsService, UserRolesService, EmailsService } from "../../services";
import { env } from "../../constants";
import { InjectionContainer } from "ts-injection";
import { Resource } from "sst";
import { auth } from "../../clients/auth.client";

const injectorConfig = {
  isManualInit: true,
  shouldThrowOnNotFound: true
} as const;

const injectors: Record<string, InjectionContainer> = {};

const environmentInjector = createEnvironmentInjector();
environmentInjector.initialize();

function createEnvironmentInjector() {
  const envInjector = new InjectionContainer(injectorConfig);
  envInjector.register(auth, AUTH_TOKEN).successOrThrow();
  envInjector.register(env, ENVIRONMENT_TOKEN).successOrThrow();
  envInjector.register(tenantsDB, TENANTS_DB_TOKEN).successOrThrow();
  envInjector.register(EnvironmentsService).successOrThrow();
  envInjector.register(EmailsService);

  return envInjector;
}

async function createTenantsInjector() {
  const container = createEnvironmentInjector();

  const environmentService = environmentInjector.resolve(EnvironmentsService);

  const { distributionArn } = Resource.App.stage === 'local' ? { distributionArn: ' / ' } : await environmentService.getCurrentEnvironment();

  const distributionId = distributionArn.split("/").pop();

  container.register(Resource.App.stage === 'local' ? '' : distributionId, DISTRIBUTION_ID_TOKEN).successOrThrow();
  container.register(KYCService).successOrThrow();
  container.register(DomainsService).successOrThrow();
  container.register(TenantsService).successOrThrow();


  return container;
};

export async function getInjector(domain?: string) {
  const defaultKey = '__default__';
  if (!domain) {
    if (injectors[defaultKey]) {
      return injectors[defaultKey];
    }

    injectors[defaultKey] = await createTenantsInjector();

    injectors[defaultKey].initialize();

    return injectors[defaultKey];
  }

  if (injectors[domain]) {
    return injectors[domain];
  }

  const baseInjector = await getInjector();

  const container = await createTenantsInjector();

  const tenantsService = baseInjector.resolve(TenantsService);
  const tenant = await tenantsService.getByDomain(domain);
  const platformDb = await tenantsService.getPlatformDBClient(domain);
  container.register(platformDb, PLATFORM_DB_TOKEN).successOrThrow();
  container.register(tenant, TENANT_TOKEN).successOrThrow();
  container.register(FilesService).successOrThrow();
  container.register(FormsService).successOrThrow();
  container.register(ApplicationsService).successOrThrow();
  container.register(ReviewsService).successOrThrow();
  container.register(UserRolesService).successOrThrow();

  injectors[domain] = container;

  container.initialize();

  return injectors[domain];
}