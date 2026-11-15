import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_CORE_URL!,
  },
  // Pick up all our schema files
  schema: ["./src/lib/entities/global/**/*.entity.ts"],
  out: "./drizzle-global",
});
