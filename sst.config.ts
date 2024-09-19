/// <reference path="./.sst/platform/config.d.ts" />

import { execSync } from "child_process";
import { turso } from "./packages/core/src/clients/turso.client";
import { createClient } from "@libsql/client/web";
import { drizzle as sqliteDrizzle } from "drizzle-orm/libsql";
import { migrate as sqliteMigrate } from "drizzle-orm/libsql/migrator";
import { migrate as pgMigrate } from "drizzle-orm/aws-data-api/pg/migrator";
import { drizzle as pgDrizzle } from "drizzle-orm/aws-data-api/pg";
import { join } from "path";
import { RDSDataClient } from "@aws-sdk/client-rds-data";
import { sql } from "drizzle-orm";

async function sqliteMigrator(url: string, authToken: string, migrationsFolder: string) {
  const db = sqliteDrizzle(
    createClient({
      url,
      authToken,
    })
  );

  await sqliteMigrate(db, { migrationsFolder });
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

    const existsDb = existingDb && existingDb.id

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

      const migrationsFolder = join(process.cwd(), 'packages', 'core', 'drizzle-sqlite');

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
    const onfidoToken = new sst.Secret("ONFIDO_TOKEN");
    const onfidoWorkflowId = new sst.Secret("ONFIDO_WORKFLOW_ID");

    const prefix = $app.stage === 'main' ? '' : $app.stage + '.';

    const domain = `${prefix}${baseDomain}` as const;

    const parameters = new sst.Linkable("Parameters", {
      properties: Object.fromEntries(
        Object.entries({
          descopeProjectId,
          awsHostedZoneId,
          onfidoToken,
          awsRegion,
          onfidoWorkflowId,
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
        }).map(([key, value]) => [key, typeof value === 'string' ? value : value.value])
      ),
    });

    const vpc = new sst.aws.Vpc("Vpc");
    const database = new sst.aws.Postgres("Database", {
      vpc,
      scaling: {
        min: '0.5 ACU',
        max: '1 ACU',
      }
    });

    const bucket = new sst.aws.Bucket("Bucket");

    const dbOutput = database.nodes.instance.endpoint.apply(() => {
      return database.database.apply(db => {
        return database.secretArn.apply(secretArn => {
          return database.clusterArn.apply(async resourceArn => {
            return await pgMigrator(db, secretArn, resourceArn, join(process.cwd(), 'packages', 'core', 'drizzle-postgres'));
          });
        });
      })
    });

    const next = new sst.aws.Nextjs("Site", {
      link: [database, bucket, parameters],
      path: './packages/web',
      domain: {
        certificateArn,
        name: domain,
        aliases: dbOutput.apply(async conn => {
          const tenants = await conn.execute(sql`SELECT * FROM tenants`);

          return tenants.rows.map(row => `${row.domain}.${domain}`);
        }),
        dns: sst.aws.dns({
          zone: 'REDACTED',
        }),
      }
    });

    next.nodes.cdn.nodes.distribution.arn.apply(arn => {
      return dbOutput.apply(async conn => {
        await conn.execute(sql`
          INSERT INTO environments (name, distribution_arn) VALUES (${$app.stage}, ${arn})
          ON CONFLICT (name) DO UPDATE SET distribution_arn = ${arn};
        `);
      });
    })

    return { next, distribution: next.nodes.cdn.nodes.distribution.arn };
  },
});
