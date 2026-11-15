import { defineConfig } from "drizzle-kit";
import { Resource as R } from "sst";

const Resource: any = new Proxy(R, {
  get(target, prop) {
    try {
      return (target as any)[prop];
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
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
  // Pick up all our schema files
  schema: ["./src/lib/entities/tenant/**/*.entity.ts"],
  out: "./drizzle-tenant",
});

