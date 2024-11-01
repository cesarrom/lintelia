import { migrate as sqliteMigrate } from "drizzle-orm/libsql/migrator";
import { drizzle as sqliteDrizzle } from "drizzle-orm/libsql";
import { Resource } from "sst";
import { drizzle } from "drizzle-orm/aws-data-api/pg";
import { RDSDataClient } from "@aws-sdk/client-rds-data";
import { createClient } from "@libsql/client/web";
import { sql } from 'drizzle-orm';
import { join } from "node:path";
import { createClient as createTursoClient } from "@tursodatabase/api";

export const tursoManagement = createTursoClient({
  org: "fintivio",
  token: "REDACTED",
});

const client = new RDSDataClient({});

export const tenantsDB = drizzle(client, {
  database: Resource.Database.database,
  secretArn: Resource.Database.secretArn,
  resourceArn: Resource.Database.clusterArn,
});


const migrateAllSqlite = async () => {
  const tenants = await tenantsDB.execute(sql`SELECT * FROM tenants`);

  for (const tenant of tenants.rows) {
    const { database_url: databaseUrl, database_auth_token: databaseAuthToken, domain, database_name: databaseName } = tenant;

    console.log('migrating tenant', domain);

    const token = await tursoManagement.databases.createToken(databaseName as string, {
      'authorization': 'full-access',
    });

    await tenantsDB.execute(sql`UPDATE tenants SET database_auth_token = ${token.jwt} WHERE domain = ${domain}`);

    const turso = createClient({
      url: databaseUrl as string,
      authToken: token.jwt as string,
    });


    const db = sqliteDrizzle(turso);

    await sqliteMigrate(db, { migrationsFolder: join(process.cwd(), '..', 'web', 'drizzle-sqlite') }).catch(console.error);
  }
}

migrateAllSqlite();