import { z } from 'zod';
import { createSelectSchema } from 'drizzle-zod';
import { tenants } from '../entities/global/tenant.entity.js';
import { platformUsers } from '../entities/global/platform-user.entity.js';

export const tenantSchema = createSelectSchema(tenants);

export type Tenant = z.infer<typeof tenantSchema>

export const platformUserSchema = createSelectSchema(platformUsers).omit({ passwordHash: true });

export type PlatformUser = z.infer<typeof platformUserSchema>
