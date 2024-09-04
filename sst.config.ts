/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "fintivio",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
      providers: { aws: true },
    };
  },
  async run() {
    // const certificateArn = "arn:aws:acm:us-east-1:664418985588:certificate/73138b5e-b2bc-4272-8cdd-d3a672aacf94";
    const baseDomain = "fintivio.org";
    const domain = `${$app.stage || 'development'}.${baseDomain}` as const;
    const vpc = new sst.aws.Vpc("Vpc");
    const database = new sst.aws.Postgres("Database", {
      vpc,
      scaling: {
        min: '0.5 ACU',
        max: '1 ACU',
      }
    });
    const bucket = new sst.aws.Bucket("Bucket");

    const next = new sst.aws.Nextjs("Site", {
      link: [database, bucket],
      path: './packages/web',
      domain: {
        dns: sst.aws.dns({
          zone: 'REDACTED',
        }),
        name: baseDomain,
        aliases: [domain],
      }
    });

    return { next };
  },
});
