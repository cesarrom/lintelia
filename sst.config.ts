// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./.sst/platform/config.d.ts" />

import { execSync } from "child_process";
import { neon, projectId, branchId, endpoint } from "./src/lib/clients/neon.client";
import { DataSource } from 'typeorm';
import * as globalMigrations from './src/migrations/global';
import * as tenantMigrations from './src/migrations/tenant';

async function tenantsMigrator(url: string, password: string) {
  try {
    const dataSource = new DataSource({
      type: 'postgres',
      url,
      password,
      migrations: Object.values(tenantMigrations),
      migrationsTableName: 'typeorm_migrations'
    });

    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.destroy();
  } catch (e) {
    console.error(e);
  }
}

async function coreMigrator(url: string, password: string) {
  try {
    const dataSource = new DataSource({
      type: 'postgres',
      url,
      password,
      migrations: Object.values(globalMigrations),
      migrationsTableName: 'typeorm_migrations'
    });

    await dataSource.initialize();
    await dataSource.runMigrations();

    return dataSource;
  } catch (e) {
    console.error(e);
  }
}

export default $config({
  app(input) {
    return {
      name: "fintivio",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
    };
  },
  async run() {
    const certificateArn = "arn:aws:acm:us-east-1:664418985588:certificate/5f3ed59e-b2ca-46b5-a786-8916cf145787";
    const baseDomain = "fintivio.org";


    const { databaseName: coreDatabaseName, databaseId: coreDatabaseId, databaseUrl: coreDatabaseUrl, databasePassword: coreDatabasePassword } = await ensureDatabase({
      prefix: 'Core',
      domainScope: 'core',
      migrator: coreMigrator,
    });
    const { databaseName: tenantDatabaseName, databaseId: tenantDatabaseId, databaseUrl: tenantDatabaseUrl, databasePassword: tenantDatabasePassword } = await ensureDatabase({
      domainScope: 'tenant-schema',
      migrator: tenantsMigrator,
    });

    const awsHostedZoneId = new sst.Secret("AWS_HOSTED_ZONE_ID");
    const awsRegion = new sst.Secret("AWS_REGION");
    const awsSecret = new sst.Secret("AWS_SECRET");
    const awsKey = new sst.Secret("AWS_KEY");
    const descopeProjectId = new sst.Secret("DESCOPE_PROJECT_ID");
    const host = new sst.Secret("HOST");
    const kycToken = new sst.Secret("KYC_TOKEN");
    const kycSecret = new sst.Secret("KYC_SECRET");
    const kycEndpoint = new sst.Secret("KYC_ENDPOINT");
    const kycWorkflowId = new sst.Secret("KYC_WORKFLOW_ID");
    const smtpHost = new sst.Secret('SMTP_HOST');
    const smtpPort = new sst.Secret('SMTP_PORT');
    const smtpSecure = new sst.Secret('SMTP_SECURE');
    const smtpUser = new sst.Secret('SMTP_USER');
    const smtpPass = new sst.Secret('SMTP_PASS');
    const emailFrom = new sst.Secret('EMAIL_FROM');
    const descopeManagementKey = new sst.Secret('DESCOPE_MANAGEMENT_KEY');
    const databaseApiKey = new sst.Secret('DATABASE_API_KEY');
    const databaseProjectId = new sst.Secret('DATABASE_PROJECT_ID');
    const openaiApiKey = new sst.Secret('OPENAI_API_KEY');
    const restateEndpoint = new sst.Secret('RESTATE_ENDPOINT');
    const prefix = $app.stage === 'main' ? '' : $app.stage + '.';

    const domain = `${prefix}${baseDomain}` as const;

    const bucket = new sst.aws.Bucket("Bucket");

    const parameters = new sst.Linkable("Parameters", {
      properties: {
        bucketArn: bucket.arn,
        bucketDomain: bucket.domain,
        bucketName: bucket.name,
        ...Object.fromEntries(
          Object.entries({
            descopeManagementKey,
            descopeProjectId,
            awsHostedZoneId,
            kycToken,
            awsRegion,
            kycWorkflowId,
            awsSecret,
            awsKey,
            host,
            baseDomain,
            openaiApiKey,
            domain,
            coreDatabaseName,
            coreDatabaseId,
            coreDatabaseUrl,
            coreDatabasePassword,
            tenantDatabaseName,
            tenantDatabaseId,
            tenantDatabaseUrl,
            tenantDatabasePassword,
            awsCertificateArn: certificateArn,
            smtpHost,
            smtpPort,
            smtpSecure,
            smtpUser,
            smtpPass,
            emailFrom,
            kycSecret,
            kycEndpoint,
            databaseApiKey,
            databaseProjectId,
            restateEndpoint,
          }).map(([key, value]) => [key, typeof value === 'string' ? value : value.value])
        )
      },
    });

    // const vpc = new sst.aws.Vpc("Vpc");


    // const database = new sst.aws.Postgres("Database", {
    //   vpc,
    //   scaling: {
    //     min: '0.5 ACU',
    //     max: '1 ACU',
    //   }
    // });

    // const executionQueue = new sst.aws.Queue("ExecutionQueue", {
    //   visibilityTimeout: '20 seconds',
    //   fifo: true,
    // });

    // const dynamoScheduler = new sst.aws.Dynamo("DynamoScheduler", {
    //   fields: {
    //     domain: "string",
    //     workflowId: "string",
    //     executionId: "string",
    //     executionNodeId: "string",
    //     eventName: "string",
    //     triggeredBy: "string",
    //     triggeredByRole: "string",
    //     listenerId: "string",
    //     expiresAt: "number"
    //   },
    //   primaryIndex: { hashKey: "executionNodeId", rangeKey: "executionId" },
    //   globalIndexes: {
    //     byWorkflowId: { rangeKey: "workflowId", hashKey: "domain" },
    //     byTriggeredByRole: { rangeKey: "triggeredByRole", hashKey: "domain" },
    //     byDomain: { rangeKey: "domain", hashKey: "workflowId" },
    //   },
    //   localIndexes: {
    //     byTriggeredBy: { rangeKey: "triggeredBy" },
    //     byEventName: { rangeKey: "eventName" },
    //     byExpiresAt: { rangeKey: "expiresAt" },
    //     byExecutionId: { rangeKey: "executionId" },
    //     byListenerId: { rangeKey: "listenerId" }
    //   },
    //   ttl: 'expiresAt',
    //   stream: "new-and-old-images"
    // });

    // dynamoScheduler.subscribe({
    //   handler: "src/functions/scheduler-subscriber.handler",
    //   timeout: '20 seconds',
    //   link: [executionQueue, parameters],
    // });

    // executionQueue.subscribe({
    //   handler: "src/functions/execution-subscriber.handler",
    //   timeout: '20 seconds',
    //   link: [dynamoScheduler, database, bucket, parameters],
    // });

    const next = new sst.aws.Nextjs("Site", {
      link: [bucket, parameters],
      path: '.',
      domain: {
        cert: certificateArn,
        name: domain,
        aliases: [`*.${domain}`],
        dns: sst.aws.dns({
          zone: 'REDACTED',
        }),
      }
    });

    $util.all([coreDatabaseUrl.value, coreDatabasePassword.value])
      .apply(async ([db, password]) => {
        const conn = await coreMigrator(db, password);

        // const _s3 = new S3({
        //   region: awsRegion,
        //   credentials: {
        //     accessKeyId: awsKey,
        //     secretAccessKey: awsSecret,
        //   },
        // });

        // await migrateForms(s3, bucketName, conn as unknown as AwsDataApiPgDatabase<Record<string, never>>);

        if ($app.stage !== 'local') {
          next?.nodes?.cdn?.nodes.distribution.arn.apply(async arn => {
            await conn?.query(`
              INSERT INTO environments (name, distribution_arn) VALUES ($1, $2)
              ON CONFLICT (name) DO UPDATE SET distribution_arn = $2;
            `, [$app.stage, arn]);
          });
        }
      });

    return { next };
  },
});

const wait = (ms: number) => new Promise(resolve => { setTimeout(resolve, ms); });

async function ensureDatabase({ domainScope, prefix = '', migrator }: { domainScope: string, prefix?: string, migrator: (url: string, password: string) => unknown }) {
  const dbName = `${$app.stage}-${domainScope}`;

  const dbValues = {
    databaseName: dbName,
    databaseId: -1,
    databaseUrl: '',
    databasePassword: '',
  };

  const dbs = await neon.listProjectBranchDatabases(projectId, branchId).then(r => r.data.databases).catch(() => []);

  const existingDb = dbs.find(db => db.name === dbName);

  const existsDb = existingDb && existingDb.id;

  if (!existsDb) {
    const role = await neon.createProjectBranchRole(projectId, branchId, {
      role: {
        name: dbName,
      }
    });

    await wait(20000);

    const tenantDbDetails = await neon.createProjectBranchDatabase(projectId, branchId, {
      database: {
        name: dbName,
        owner_name: role.data.role.name,
      }
    });

    await wait(20000);

    const password = await neon.resetProjectBranchRolePassword(projectId, branchId, role.data.role.name, {});

    await wait(20000);

    dbValues.databaseName = dbName;
    dbValues.databaseId = tenantDbDetails.data.database.id;
    dbValues.databaseUrl = `postgresql://${role.data.role.name}:${password.data.role.password}@${endpoint}/${tenantDbDetails.data.database.name}?sslmode=require`;
    dbValues.databasePassword = password.data.role.password || '';

    const setSecret = (name: string, value: string) => {
      const command = $app.stage === 'local' ? `pnpm run sst-secret set` : `sst secret set`;
      execSync(`${command} ${name} ${value} --stage=${$app.stage}`);
    };

    setSecret(`${prefix}DatabaseName`, dbValues.databaseName);
    setSecret(`${prefix}DatabaseId`, dbValues.databaseId.toString());
    setSecret(`${prefix}DatabaseUrl`, dbValues.databaseUrl);
    setSecret(`${prefix}DatabasePassword`, dbValues.databasePassword);
  }

  const databaseName = new sst.Secret(`${prefix}DatabaseName`);
  const databaseId = new sst.Secret(`${prefix}DatabaseId`);
  const databaseUrl = new sst.Secret(`${prefix}DatabaseUrl`);
  const databasePassword = new sst.Secret(`${prefix}DatabasePassword`);

  $util.all([databaseUrl.value, databasePassword.value]).apply(([db, password]) => {
    console.log({ db, password });
    return migrator(db, password);
  });

  return {
    databaseName,
    databaseId,
    databaseUrl,
    databasePassword,
  };
}