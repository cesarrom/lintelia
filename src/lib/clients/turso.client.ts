import { createClient } from "@tursodatabase/api";

export const turso = createClient({
  org: "fintivio",
  token: "REDACTED",
});