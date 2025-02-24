'use server';

import { getInjector } from "@/lib/injector/injector";
import { TENANT_DB_TOKEN } from "@/lib/injector/tokens";
import { createHash } from "crypto";

export async function verifyApiKey(apiKeyId: string, providedKey: string): Promise<boolean> {
  try {
    const injector = await getInjector();
    const platformDb = injector.resolve(TENANT_DB_TOKEN);

    const apiKey = await platformDb.query.apiKeys.findFirst({
      where: (apiKeys, { eq }) => eq(apiKeys.id, apiKeyId),
      columns: {
        key: true,
        enabled: true,
        expiresAt: true,
      },
    });

    if (!apiKey) return false;
    if (!apiKey.enabled) return false;
    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) return false;

    // Hash the provided key with the same algorithm used when storing
    const hashedKey = createHash('sha256').update(providedKey).digest('hex');
    
    return hashedKey === apiKey.key;
  } catch (error) {
    console.error("Error verifying API key:", error);
    return false;
  }
} 