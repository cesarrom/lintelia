import { Resource } from "sst";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  driver: "aws-data-api",
  dialect: "postgresql",
  dbCredentials: {
    database: Resource.Database.database,
    secretArn: Resource.Database.secretArn,
    resourceArn: Resource.Database.clusterArn,
  },
  // Pick up all our schema files
  schema: ["./src/models/tenants.sql.ts"],
  out: "../web/drizzle-postgres",
});
