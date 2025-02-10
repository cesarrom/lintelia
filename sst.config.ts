// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./.sst/platform/config.d.ts" />

import { execSync } from "child_process";
import { turso } from "./src/lib/clients/turso.client";
import { createClient } from "@libsql/client/web";
import { drizzle as sqliteDrizzle } from "drizzle-orm/libsql";
import { migrate as sqliteMigrate } from "drizzle-orm/libsql/migrator";
import { migrate as pgMigrate } from "drizzle-orm/aws-data-api/pg/migrator";
import { AwsDataApiPgDatabase, drizzle as pgDrizzle } from "drizzle-orm/aws-data-api/pg";
import { join } from "path";
import { RDSDataClient } from "@aws-sdk/client-rds-data";
import { sql } from "drizzle-orm";
import { S3 } from "aws-sdk";
import { existsSync, readdirSync, readFileSync } from "fs";

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

    const dbValues = {
      databaseName: $app.stage,
      databaseId: '',
      databaseUrl: '',
      databaseAuthToken: '',
    };

    const existingDb = await turso.databases.get(dbValues.databaseName).catch(() => null);

    const existsDb = existingDb && existingDb.id;

    const migrationsFolder = join(process.cwd(), 'drizzle-sqlite');

    if (!existsDb) {
      const db = await turso.databases.create(dbValues.databaseName, {
        is_schema: true,
        group: 'fintivio-platform',
      });

      const token = await turso.databases.createToken(db.name, {
        'authorization': 'full-access',
      });

      dbValues.databaseName = db.name;
      dbValues.databaseId = db.id;
      dbValues.databaseUrl = `libsql://${db.name}-fintivio.turso.io`;
      dbValues.databaseAuthToken = token.jwt;

      const setSecret = (name: string, value: string) => {
        console.log(`Setting ${name} to ${value}`);
        const command = $app.stage === 'local' ? `pnpm run set-env && pnpm sst secret set` : `sst secret set`;
        execSync(`${command} ${name} ${value} --stage=${$app.stage}`);
      };

      setSecret("DatabaseName", dbValues.databaseName);
      setSecret("DatabaseId", dbValues.databaseId);
      setSecret("DatabaseUrl", dbValues.databaseUrl);
      setSecret("DatabaseAuthToken", dbValues.databaseAuthToken);


      await sqliteMigrator(dbValues.databaseUrl, dbValues.databaseAuthToken, migrationsFolder);
    }

    const awsHostedZoneId = new sst.Secret("AWS_HOSTED_ZONE_ID");
    const awsRegion = new sst.Secret("AWS_REGION");
    const awsSecret = new sst.Secret("AWS_SECRET");
    const awsKey = new sst.Secret("AWS_KEY");
    const descopeProjectId = new sst.Secret("DESCOPE_PROJECT_ID");
    const host = new sst.Secret("HOST");
    const databaseName = new sst.Secret("DatabaseName");
    const databaseId = new sst.Secret("DatabaseId");
    const databaseUrl = new sst.Secret("DatabaseUrl");
    const databaseAuthToken = new sst.Secret("DatabaseAuthToken");
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
            domain,
            databaseName,
            databaseId,
            databaseUrl,
            databaseAuthToken,
            awsCertificateArn: certificateArn,
            smtpHost,
            smtpPort,
            smtpSecure,
            smtpUser,
            smtpPass,
            emailFrom,
            kycSecret,
            kycEndpoint,
          }).map(([key, value]) => [key, typeof value === 'string' ? value : value.value])
        )
      },
    });

    const vpc = new sst.aws.Vpc("Vpc");


    const database = new sst.aws.Postgres("Database", {
      vpc,
      scaling: {
        min: '0.5 ACU',
        max: '1 ACU',
      }
    });

    const executionQueue = new sst.aws.Queue("ExecutionQueue", {
      visibilityTimeout: '20 seconds',
      fifo: true,
    });

    const dynamoScheduler = new sst.aws.Dynamo("DynamoScheduler", {
      fields: {
        domain: "string",
        workflowId: "string",
        executionId: "string",
        executionNodeId: "string",
        eventName: "string",
        triggeredBy: "string",
        triggeredByRole: "string",
        listenerId: "string",
        expiresAt: "number"
      },
      primaryIndex: { hashKey: "executionNodeId", rangeKey: "executionId" },
      globalIndexes: {
        byWorkflowId: { rangeKey: "workflowId", hashKey: "domain" },
        byTriggeredByRole: { rangeKey: "triggeredByRole", hashKey: "domain" },
        byDomain: { rangeKey: "domain", hashKey: "workflowId" },
      },
      localIndexes: {
        byTriggeredBy: { rangeKey: "triggeredBy" },
        byEventName: { rangeKey: "eventName" },
        byExpiresAt: { rangeKey: "expiresAt" },
        byExecutionId: { rangeKey: "executionId" },
        byListenerId: { rangeKey: "listenerId" }
      },
      ttl: 'expiresAt',
      stream: "new-and-old-images"
    });

    dynamoScheduler.subscribe({
      handler: "src/functions/scheduler-subscriber.handler",
      timeout: '20 seconds',
      link: [executionQueue, parameters],
    });

    executionQueue.subscribe({
      handler: "src/functions/execution-subscriber.handler",
      timeout: '20 seconds',
      link: [dynamoScheduler, database, bucket, parameters],
    });

    const dbOutput = $util.all([database.database, database.secretArn, database.clusterArn]).apply(([db, secretArn, resourceArn]) => {
      return {
        db: db,
        secretArn: secretArn,
        resourceArn: resourceArn,
      };
    });

    const next = new sst.aws.Nextjs("Site", {
      link: [database, bucket, parameters],
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

    $util.all([awsRegion.value, awsSecret.value, awsKey.value, bucket.name, databaseUrl.value, databaseAuthToken.value, dbOutput])
      .apply(async ([awsRegion, awsSecret, awsKey, bucketName, databaseUrl, databaseAuthToken, connDetails]) => {
        const conn = await pgMigrator(connDetails.db, connDetails.secretArn, connDetails.resourceArn, join(process.cwd(), 'drizzle-postgres'));

        await sqliteMigrator(databaseUrl, databaseAuthToken, migrationsFolder);

        const _s3 = new S3({
          region: awsRegion,
          credentials: {
            accessKeyId: awsKey,
            secretAccessKey: awsSecret,
          },
        });

        // await migrateForms(s3, bucketName, conn as unknown as AwsDataApiPgDatabase<Record<string, never>>);

        if ($app.stage !== 'local') {
          next.nodes.cdn.nodes.distribution.arn.apply(async arn => {
            await conn.execute(sql`
              INSERT INTO environments (name, distribution_arn) VALUES (${$app.stage}, ${arn})
              ON CONFLICT (name) DO UPDATE SET distribution_arn = ${arn};
            `);
          });
        }
      });

    return { next };
  },
});

async function migrateForms(s3: S3, BUCKET_NAME: string, conn: AwsDataApiPgDatabase<Record<string, never>>) {
  const migrationDate = new Date().toISOString().split('T')[0];
  const formsDir = join(process.cwd(), 'forms')
  const purposes = readdirSync(formsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)

  for (const purpose of purposes) {
    const purposeDir = join(formsDir, purpose)
    const formPath = join(purposeDir, 'form.json')
    const assessmentPath = join(purposeDir, 'assessment.dmn')

    if (!existsSync(formPath) || !existsSync(assessmentPath)) {
      continue;
    }

    const formContent = readFileSync(formPath)
    const assessmentContent = readFileSync(assessmentPath)

    const { Key: form } = await s3.upload({
      Bucket: BUCKET_NAME,
      Key: `${purpose}--${migrationDate}_form.json`,
      Body: formContent,
    }).promise()

    const { Key: dmn } = await s3.upload({
      Bucket: BUCKET_NAME,
      Key: `${purpose}--${migrationDate}_assessment.dmn`,
      Body: assessmentContent,
    }).promise()
    await conn.execute(sql`
      DELETE FROM default_forms WHERE purpose = ${purpose}`
    );
    await conn.execute(sql`
      INSERT INTO default_forms (purpose, form_key, dmn_key) VALUES (${purpose}, ${form}, ${dmn})`
    );
  }
}

async function sqliteMigrator(url: string, authToken: string, migrationsFolder: string) {
  try {
    const db = sqliteDrizzle(
      createClient({
        url,
        authToken,
      })
    );

    await sqliteMigrate(db, { migrationsFolder });
  } catch (e) {
    console.error(e);
  }
}

async function pgMigrator(database: string, secretArn: string, clusterArn: string, migrationsFolder: string) {
  const client = new RDSDataClient({});

  const db = pgDrizzle(client, {
    database,
    secretArn,
    resourceArn: clusterArn,
  });

  await pgMigrate(db, { migrationsFolder });

  return db;
}
