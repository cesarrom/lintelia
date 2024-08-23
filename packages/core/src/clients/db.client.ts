
import { RDS } from "sst/node/rds";
import { drizzle } from "drizzle-orm/aws-data-api/pg";
import { RDSDataClient } from "@aws-sdk/client-rds-data";

const client = new RDSDataClient({});

export const db = drizzle(client, {
  database: RDS.Postgres.defaultDatabaseName,
  secretArn: RDS.Postgres.secretArn,
  resourceArn: RDS.Postgres.clusterArn,
});