import { z } from 'zod';
import { createSelectSchema } from 'drizzle-zod';
import { environments } from '../entities/global/environment.entity.js';
import { tenants } from '../entities/global/tenant.entity.js';

export const environmentSchema = createSelectSchema(environments);

export type Environment = z.infer<typeof environmentSchema>;

export const tenantSchema = createSelectSchema(tenants);

export type Tenant = z.infer<typeof tenantSchema>

