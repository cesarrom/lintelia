import { createApiClient } from "@neondatabase/api-client";
import { env } from "../constants";

export const neon = createApiClient({
  apiKey: env.DATABASE_API_KEY,
});

export const projectId = env.DATABASE_PROJECT_ID;

export const branchId = 'br-yellow-star-a5qcsdsq';

export const endpoint = 'ep-flat-bar-a547qelr-pooler.us-east-2.aws.neon.tech';

export const ownerName = 'neondb_owner';