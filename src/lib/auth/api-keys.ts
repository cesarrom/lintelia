'use server';

import { Service } from "../services/service";
import { createHash } from "crypto";
import { container } from "tsyringe";
import { TenantsService } from "../services/tenants.service";

export async function verifyApiKey(apiKeyId: string, providedKey: string): Promise<boolean> {
  try {
    const injector = container.createChildContainer();
    const [tenantsService] = Service.inject([TenantsService], () => injector);
    const platformDb = await tenantsService.getContextualPlatformDBClient();


    const apiKey = await platformDb.query('apiKeys').findFirst({
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