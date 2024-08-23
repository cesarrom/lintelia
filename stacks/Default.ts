import { StackContext, NextjsSite, RDS, Bucket } from "sst/constructs";
import { RemovalPolicy } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";

export function API({ stack }: StackContext) {
  // const baseDomain = "fintivio.org";
  // const targetDomainName = `${process.env.NODE_ENV || 'development'}.${baseDomain}`;

  // const rds = new RDS(stack, "Postgres", {
  //   engine: "postgresql13.9",
  //   defaultDatabaseName: "fintivio",
  // });

  // const bucket = new Bucket(stack, "Bucket", {
  //   cdk: {
  //     bucket: {
  //       autoDeleteObjects: true,
  //       removalPolicy: RemovalPolicy.DESTROY,
  //     },
  //   },
  // });

  // const site = new NextjsSite(stack, "Site", {
  //   path: "packages/web",
  //   bind: [rds, bucket],
  //   customDomain: {
  //     domainName: targetDomainName,
  //     hostedZone: baseDomain,
  //   },
  // });

  // stack.addOutputs({
  //   Site: site.customDomainUrl || site.url,
  // });
}
