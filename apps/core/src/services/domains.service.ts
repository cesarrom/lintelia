import AWS, { Route53, CloudFront } from 'aws-sdk';
import assert from 'assert';
import { AbstractService } from './service';
import { EnvironmentsService } from './environments.service';
import { Injectable, Inject, Scope } from "@nestjs/common";
import { ENV } from '../injector/tokens/env.token';
import { type AppEnvironment } from '../constants';
import { CNAMERecordResponse, TenantDomainSetupRequest } from '@repo/fintivio/schemas';

@Injectable({
  scope: Scope.REQUEST
})
export class DomainsService extends AbstractService {
  private _route53?: Route53;
  private _cloudFront?: CloudFront;
  private distributionId?: string;

  constructor(
    @Inject(ENV) private env: AppEnvironment,
    @Inject(EnvironmentsService) private environmentsService: EnvironmentsService
  ) {
    super();
  }

  private get hostedZoneId() {
    return this.env.AWS_HOSTED_ZONE_ID;
  }

  private get route53() {
    if (!this._route53) {
      this._route53 = new Route53({
        region: this.env.AWS_REGION,
        secretAccessKey: this.env.AWS_SECRET,
        accessKeyId: this.env.AWS_KEY,
      });
    }

    return this._route53;
  }

  private get cloudFront() {
    if (!this._cloudFront) {
      this._cloudFront = new CloudFront({
        apiVersion: '2020-05-31',
        secretAccessKey: this.env.AWS_SECRET,
        accessKeyId: this.env.AWS_KEY,
      });
    }

    return this._cloudFront;
  }

  private async getDistributionId() {
    if (this.distributionId !== undefined) {
      return this.distributionId!;
    }
    this.distributionId = await this.environmentsService.getDistributionId();

    return this.distributionId!;
  }

  async getDistributionConfig() {

    try {
      const params = {
        Id: await this.getDistributionId()
      };
      const data = await this.cloudFront.getDistributionConfig(params).promise();
      return data;
    } catch (err) {
      console.error("Error fetching distribution config: ", err);
      throw err;
    }
  }

  async setCertificateByArn(arn: string) {
    try {
      const { DistributionConfig, ETag } = await this.getDistributionConfig();

      assert(DistributionConfig, 'DistributionConfig is required');
      assert(ETag, 'ETag is required');

      // Update the ViewerCertificate with the new ARN
      DistributionConfig.ViewerCertificate = {
        ACMCertificateArn: arn,
        SSLSupportMethod: 'sni-only',
        MinimumProtocolVersion: 'TLSv1.2_2021',
        Certificate: arn,
        CertificateSource: 'acm'
      };

      const updatedDistribution = await this.updateDistribution(DistributionConfig, ETag);
      return updatedDistribution;
    } catch (err) {
      console.error("Error setting certificate by ARN: ", err);
      throw err;
    }
  }

  async updateDistribution(config: CloudFront.DistributionConfig, etag: string, certificateProcessDone = false): Promise<CloudFront.UpdateDistributionResult> {
    try {
      const params = {
        Id: await this.getDistributionId(),
        DistributionConfig: config,
        IfMatch: etag
      };
      const data = await this.cloudFront.updateDistribution(params).promise();
      return data;
    } catch (err) {
      console.error("Error updating distribution: ", err);
      if (String(err).includes("The certificate that is attached to your distribution doesn't cover the alternate domain name") && !certificateProcessDone) {
        await this.setCertificateByArn(this.env.AWS_CERTIFICATE_ARN);
        return this.updateDistribution(config, etag, true);
      } else {
        throw err;
      }

    }
  }

  async addAlias(newAlias: string) {
    if (!this.distributionId) {
      return;
    }
    try {
      const { DistributionConfig, ETag } = await this.getDistributionConfig();

      assert(DistributionConfig, 'DistributionConfig is required');
      assert(ETag, 'ETag is required');

      // Check if the alias already exists
      if (!DistributionConfig.Aliases?.Items?.includes(newAlias)) {
        assert(DistributionConfig.Aliases, 'Aliases is required');
        assert(DistributionConfig.Aliases.Items, 'Aliases.Items is required');

        DistributionConfig.Aliases.Items.push(newAlias);
        DistributionConfig.Aliases.Quantity += 1;
      }

      const updatedDistribution = await this.updateDistribution(DistributionConfig, ETag);
      return updatedDistribution;
    } catch (err) {
      console.error("Error adding alias: ", err);
      throw err;
    }
  }

  async removeAlias(aliasToRemove: string) {
    if (!this.distributionId) {
      return;
    }
    try {
      const { DistributionConfig, ETag } = await this.getDistributionConfig();

      assert(DistributionConfig, 'DistributionConfig is required');
      assert(ETag, 'ETag is required');
      assert(DistributionConfig.Aliases, 'Aliases is required');
      assert(DistributionConfig.Aliases.Items, 'Aliases.Items is required');

      const aliasIndex = DistributionConfig.Aliases.Items.indexOf(aliasToRemove);
      if (aliasIndex !== -1) {
        // Remove the alias
        DistributionConfig.Aliases.Items.splice(aliasIndex, 1);
        DistributionConfig.Aliases.Quantity -= 1;
      }

      const updatedDistribution = await this.updateDistribution(DistributionConfig, ETag);
      return updatedDistribution;
    } catch (err) {
      console.error("Error removing alias: ", err);
      throw err;
    }
  }

  async createSubdomain(subdomain: string, target: string, isAlias: boolean = false): Promise<void> {
    const params: Route53.ChangeResourceRecordSetsRequest = {
      HostedZoneId: this.hostedZoneId,
      ChangeBatch: {
        Changes: [
          {
            Action: 'CREATE',
            ResourceRecordSet: {
              Name: `${subdomain}.${target}`,
              Type: isAlias ? 'A' : 'CNAME',
              ...(
                isAlias ?
                  {
                    AliasTarget: {
                      HostedZoneId: this.hostedZoneId,
                      DNSName: target,
                      EvaluateTargetHealth: false
                    }
                  } :
                  {
                    ResourceRecords: [{ Value: target }],
                    TTL: 300,
                  }
              ),
            }
          }
        ]
      }
    }

    try {
      if (isAlias) {
        await this.addAlias(`${subdomain}.${target}`);
      }

      await this.route53.changeResourceRecordSets(params).promise().catch(e => console.error(e));
      console.log(`Subdomain ${subdomain}.fintivio.org created successfully.`)
    } catch (error) {
      console.error(`Error creating subdomain ${subdomain}.fintivio.org:`, error)
      throw error
    }
  }

  async deleteSubdomain(subdomain: string, target: string, isAlias: boolean = false): Promise<void> {
    const params: Route53.ChangeResourceRecordSetsRequest = {
      HostedZoneId: this.hostedZoneId,
      ChangeBatch: {
        Changes: [
          {
            Action: 'DELETE',
            ResourceRecordSet: {
              Name: `${subdomain}.fintivio.org`,
              Type: isAlias ? 'A' : 'CNAME',
              ...(
                isAlias ?
                  {
                    AliasTarget: {
                      HostedZoneId: this.hostedZoneId,
                      DNSName: target,
                      EvaluateTargetHealth: false
                    }
                  } :
                  {
                    ResourceRecords: [{ Value: target }],
                    TTL: 300,
                  }
              )
            }
          }
        ]
      }
    }

    try {
      if (isAlias) {
        await this.removeAlias(`${subdomain}.${target}`);
      }

      await this.route53.changeResourceRecordSets(params).promise().catch(e => console.error(e));

      console.log(`Subdomain ${subdomain} deleted successfully.`)
    } catch (error) {
      console.error(`Error deleting subdomain ${subdomain}:`, error)
      throw error
    }
  }

  async setupTenantDomains({
    tenantDomains,
  }: TenantDomainSetupRequest): Promise<CNAMERecordResponse[]> {
    if (!tenantDomains?.length) {
      throw new Error('No tenant domains provided');
    }

    const acm = new AWS.ACM({
      region: this.env.AWS_REGION,
      accessKeyId: this.env.AWS_KEY,
      secretAccessKey: this.env.AWS_SECRET,
    });

    // Request a certificate for the tenant domains
    const certificateArn = await this.requestCertificate(acm, tenantDomains);

    // Wait for certificate to be issued
    await this.waitForCertificateValidation(acm, certificateArn);

    // Retrieve DNS validation records
    const validationRecords = await this.getValidationRecords(acm, certificateArn);

    // Update CloudFront distribution with new domains and certificate
    await this.updateCloudFront(this.cloudFront, await this.getDistributionId(), tenantDomains, certificateArn);

    return validationRecords;
  }

  private async waitForCertificateValidation(acm: AWS.ACM, certificateArn: string, maxAttempts = 60): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const { Certificate } = await acm.describeCertificate({ CertificateArn: certificateArn }).promise();
      if (Certificate?.Status === 'ISSUED') {
        return;
      }
      if (Certificate?.Status === 'FAILED') {
        throw new Error('Certificate validation failed');
      }
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds between checks
    }
    throw new Error('Certificate validation timed out');
  }

  private async requestCertificate(acm: AWS.ACM, domains: string[]): Promise<string> {
    const params = {
      DomainName: domains[0],
      SubjectAlternativeNames: domains.slice(1), // Only include additional domains
      ValidationMethod: 'DNS',
    };

    try {
      const { CertificateArn } = await acm.requestCertificate(params).promise();
      if (!CertificateArn) {
        throw new Error('Failed to request certificate');
      }

      console.log(`Requested certificate with ARN: ${CertificateArn}`);
      return CertificateArn;
    } catch (error) {
      console.error('Error requesting certificate:', error);
      throw error;
    }
  }

  private async getValidationRecords(acm: AWS.ACM, certificateArn: string): Promise<CNAMERecordResponse[]> {
    try {
      const { Certificate } = await acm.describeCertificate({ CertificateArn: certificateArn }).promise();
      if (!Certificate?.DomainValidationOptions) {
        throw new Error('Failed to retrieve certificate validation details');
      }

      const validationRecords: CNAMERecordResponse[] = Certificate.DomainValidationOptions
        .filter(option => option.ResourceRecord)
        .map(option => ({
          Name: option.ResourceRecord!.Name,
          Type: option.ResourceRecord!.Type,
          Value: option.ResourceRecord!.Value,
        }));

      if (!validationRecords.length) {
        throw new Error('No validation records found');
      }

      return validationRecords;
    } catch (error) {
      console.error('Error getting validation records:', error);
      throw error;
    }
  }

  private async updateCloudFront(
    cloudfront: AWS.CloudFront,
    distributionId: string,
    domains: string[],
    certificateArn: string
  ): Promise<void> {
    try {
      const { DistributionConfig, ETag } = await cloudfront
        .getDistributionConfig({ Id: distributionId })
        .promise();

      assert(DistributionConfig, 'DistributionConfig is required');
      assert(ETag, 'ETag is required');
      assert(DistributionConfig.Aliases, 'Aliases is required');
      assert(DistributionConfig.Aliases.Items, 'Aliases.Items is required');

      // Preserve existing aliases and add new ones
      const existingAliases = DistributionConfig.Aliases.Items || [];
      const uniqueDomains = Array.from(new Set([...existingAliases, ...domains]));

      DistributionConfig.Aliases = {
        Quantity: uniqueDomains.length,
        Items: uniqueDomains,
      };

      DistributionConfig.ViewerCertificate = {
        ACMCertificateArn: certificateArn,
        SSLSupportMethod: 'sni-only',
        MinimumProtocolVersion: 'TLSv1.2_2021',
        Certificate: certificateArn,
        CertificateSource: 'acm'
      };

      await cloudfront
        .updateDistribution({
          Id: distributionId,
          IfMatch: ETag,
          DistributionConfig,
        })
        .promise();

      console.log('Updated CloudFront distribution with new domains');
    } catch (error) {
      console.error('Error updating CloudFront distribution:', error);
      throw error;
    }
  }
}