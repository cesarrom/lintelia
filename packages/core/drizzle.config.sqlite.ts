import { defineConfig } from "drizzle-kit";
import { Resource as R } from "sst";

const Resource = new Proxy(R, {
  get(target, prop) {
    try {
      return target[prop];
    } catch {
      return new Proxy({}, {
        get() {
          return "";
        }
      })
    }
  }
});

const tenant = process.env.TENANT;

const url = tenant ? tenant : Resource.Parameters.databaseUrl;

console.log(url);

export default defineConfig({
  dialect: "sqlite",
  driver: 'turso',
  // Pick up all our schema files
  dbCredentials: {
    url,
    // authToken: process.env.DATABASE_AUTH_TOKEN!,
    authToken: process.env.TENANT_TOKEN || Resource.Parameters.databaseAuthToken,
  },
  schema: ["./src/models/platform.sql.ts"],
  out: "../web/drizzle-sqlite",
});
