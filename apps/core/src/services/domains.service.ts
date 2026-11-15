import { Injectable, Inject, Scope } from "@nestjs/common";
import type { CNAMERecordResponse, TenantDomainSetupRequest } from '@repo/fintivio/schemas';
import { AbstractService } from './service';
import { ENV } from '../injector/tokens/env.token';
import { type AppEnvironment } from '../constants';

/**
 * Custom domains for tenants.
 *
 * The previous implementation drove AWS directly (CloudFront aliases, Route53 records, ACM certificates) through the
 * end-of-life `aws-sdk` v2. Locally nothing is provisioned: this returns the DNS records the tenant has to create
 * (CNAME to the platform ingress), which is also the first step of the self-service DNS management planned for
 * tenants. A provider that provisions certificates/edge aliases belongs behind this same method.
 */
@Injectable({
  scope: Scope.REQUEST
})
export class DomainsService extends AbstractService {
  constructor(@Inject(ENV) private env: AppEnvironment) {
    super();
  }

  private get ingressHost() {
    return this.env.BASE_DOMAIN.split(':')[0];
  }

  async setupTenantDomains({ tenantDomains }: TenantDomainSetupRequest): Promise<CNAMERecordResponse[]> {
    return tenantDomains
      .map((domain) => domain.trim().toLowerCase().split(':')[0])
      .filter((host) => host && host !== this.ingressHost && !host.endsWith('.localhost') && host !== 'localhost')
      .map((host) => ({ Name: host, Type: 'CNAME', Value: this.ingressHost }));
  }
}
