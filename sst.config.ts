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
    const baseDomain = "fintivio.org";
    const domain = `${$app.stage || 'development'}.${baseDomain}`;

    const vpc = new sst.aws.Vpc("Vpc");

    const database = new sst.aws.Postgres("Database", { vpc });
    const bucket = new sst.aws.Bucket("Bucket");

    const next = new sst.aws.Nextjs("Next", {
      link: [database, bucket],
      path: './packages/web',
      domain: {
        name: baseDomain,
        aliases: [domain],
      }
    });

    return { next };
  },
});
