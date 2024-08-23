import { StackContext, NextjsSite, RDS, Bucket } from "sst/constructs";
import { RemovalPolicy } from "aws-cdk-lib";

export function API({ stack }: StackContext) {
  const rds = new RDS(stack, "Postgres", {
    engine: "postgresql13.9",
    defaultDatabaseName: "fintivio",
  });

  const bucket = new Bucket(stack, "Bucket", {
    cdk: {
      bucket: {
        autoDeleteObjects: true,
        removalPolicy: RemovalPolicy.DESTROY,
      },
    },
  });

  const site = new NextjsSite(stack, "Site", {
    path: "packages/web",
    bind: [rds, bucket],
    customDomain: {
      domainName: `${process.env.NODE_ENV || 'development'}.fintivio.com`,
      hostedZone: "fintivio.org",
    },
  });

  stack.addOutputs({
    Site: site.customDomainUrl || site.url,
  });
}
