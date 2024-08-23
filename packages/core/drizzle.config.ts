import { RDS } from "sst/node/rds";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  driver: "aws-data-api",
  dialect: "postgresql",
  dbCredentials: {
    database: RDS.Postgres.defaultDatabaseName,
    secretArn: RDS.Postgres.secretArn,
    resourceArn: RDS.Postgres.clusterArn,
  },
  // Pick up all our schema files
  schema: ["./src/**/*.sql.ts"],
  out: "./migrations",
});