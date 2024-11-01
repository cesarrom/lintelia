import { Route53, CloudFront } from 'aws-sdk';
import { DISTRIBUTION_ID_TOKEN, ENVIRONMENT_TOKEN } from '../libs/injector/tokens';
import { env } from '../constants';
import { Autowire, Injectable } from 'ts-injection';

@Injectable()
export class DomainsService {
  private _route53: Route53;
  private _cloudFront: CloudFront;

  @Autowire(ENVIRONMENT_TOKEN)
  private _env: typeof env
  @Autowire(DISTRIBUTION_ID_TOKEN)
  private distributionId: string;

  private get hostedZoneId() {
    return this._env.AWS_HOSTED_ZONE_ID;
  }

  private get route53() {
    if (!this._route53) {
      this._route53 = new Route53({
        region: this._env.AWS_REGION,
        secretAccessKey: this._env.AWS_SECRET,
        accessKeyId: this._env.AWS_KEY,
      });
    }

    return this._route53;
  }

  private get cloudFront() {
    if (!this._cloudFront) {
      this._cloudFront = new CloudFront({
        apiVersion: '2020-05-31',
        secretAccessKey: this._env.AWS_SECRET,
        accessKeyId: this._env.AWS_KEY,
      });
    }

    return this._cloudFront;
  }

  async getDistributionConfig() {
    try {
      const params = {
        Id: this.distributionId
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

  async updateDistribution(config: CloudFront.DistributionConfig, etag: string, certificateProcessDone = false) {
    try {
      const params = {
        Id: this.distributionId,
        DistributionConfig: config,
        IfMatch: etag
      };
      const data = await this.cloudFront.updateDistribution(params).promise();
      return data;
    } catch (err) {
      console.error("Error updating distribution: ", err);
      if (String(err).includes("The certificate that is attached to your distribution doesn't cover the alternate domain name") && !certificateProcessDone) {
        await this.setCertificateByArn(this._env.AWS_CERTIFICATE_ARN);
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

      // Check if the alias already exists
      if (!DistributionConfig.Aliases.Items.includes(newAlias)) {
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
}