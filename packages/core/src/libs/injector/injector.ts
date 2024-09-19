import { DISTRIBUTION_ID_TOKEN, ENVIRONMENT_TOKEN, PLATFORM_DB_TOKEN, TENANTS_DB_TOKEN } from "./tokens";
import { tenantsDB } from "../../models/tenants.sql";
import { ApplicationsService, DomainsService, EnvironmentsService, FilesService, FormsService, KYCService, ReviewsService, TenantsService, UsersService } from "../../services";
import { env } from "../../constants";
import { InjectionContainer } from "ts-injection";

const injectorConfig = {
  isManualInit:  true,
  shouldThrowOnNotFound: true
} as const;

const envInjector = new InjectionContainer(injectorConfig);
envInjector.register(env, ENVIRONMENT_TOKEN).successOrThrow();
envInjector.register(tenantsDB, TENANTS_DB_TOKEN).successOrThrow();
envInjector.register(EnvironmentsService).successOrThrow();
envInjector.initialize();

const injectors: Record<string, InjectionContainer> = {};

const createDefaultInjector = async () => {
  const container = new InjectionContainer(injectorConfig);

  const environmentService = envInjector.resolve(EnvironmentsService);

  const { distributionArn } = await environmentService.getCurrentEnvironment();

  const distributionId = distributionArn.split("/").pop();

  container.register(distributionId, DISTRIBUTION_ID_TOKEN).successOrThrow();
  container.register(env, ENVIRONMENT_TOKEN).successOrThrow();
  container.register(tenantsDB, TENANTS_DB_TOKEN).successOrThrow();
  container.register(EnvironmentsService).successOrThrow();
  container.register(KYCService).successOrThrow();
  container.register(DomainsService).successOrThrow();
  container.register(TenantsService).successOrThrow();

  return container;
};

export const getInjector = async (domain?: string) => {
  const defaultKey = '__default__';
  if (!domain) {
    if (injectors[defaultKey]) {
      return injectors[defaultKey];
    }

    injectors[defaultKey] = await createDefaultInjector();

    injectors[defaultKey].initialize();

    return injectors[defaultKey];
  }

  if (injectors[domain]) {
    return injectors[domain];
  }

  const baseInjector = await getInjector();

  const container = await createDefaultInjector();

  const tenantsService = baseInjector.resolve(TenantsService);
  const platformDb = await tenantsService.getPlatformDBClient(domain);
  container.register(platformDb, PLATFORM_DB_TOKEN).successOrThrow();

  container.register(ApplicationsService).successOrThrow();
  container.register(FilesService).successOrThrow();
  container.register(FormsService).successOrThrow();
  container.register(ReviewsService).successOrThrow();
  container.register(UsersService).successOrThrow();

  injectors[domain] = container;

  container.initialize();

  return injectors[domain];
}