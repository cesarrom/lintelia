import { WebService } from "../../services/web.service";
import { TenantsService } from "../../services/tenants.service";


export const TENANT = Symbol.for("TENANT");
export const TENANT_PROVIDER = {
  provide: TENANT,
  inject: [WebService, TenantsService],
  useFactory: async (webService: WebService, tenantService: TenantsService) => {
    const { domain } = await webService.getTenantAndDomain();

    if (!domain) {
      return null;
    }

    const tenant = await tenantService.getByDomain(domain);

    return tenant;
  }
};