import { eq } from "drizzle-orm";
import { roles } from "../models/platform.sql";
import { Injectable } from "ts-injection";
import type { PlatformDB } from "./tenants.service";
import type { RolePermissions } from "../types/permissions";
import { v4 as uuid } from 'uuid';

@Injectable()
export class RolesService {
  constructor(private readonly db: PlatformDB) {}

  async create(data: CreateRoleInput) {
    const [role] = await this.db.insert(roles).values({
      id: uuid(),
      name: data.name,
      description: data.description || '',
      permissions: JSON.stringify(data.permissions),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }).returning();

    return {
      ...role,
      permissions: JSON.parse(role.permissions),
    };
  }

  async update(id: string, data: UpdateRoleInput) {
    const [role] = await this.db.update(roles)
      .set({
        name: data.name,
        description: data.description || '',
        permissions: data.permissions ? JSON.stringify(data.permissions) : undefined,
        updatedAt: Date.now(),
      })
      .where(eq(roles.id, id))
      .returning();

    return {
      ...role,
      permissions: JSON.parse(role.permissions),
    };
  }

  async delete(id: string) {
    const [role] = await this.db.delete(roles).where(eq(roles.id, id)).returning();
    return role;
  }

  async getById(id: string) {
    const role = await this.db.select().from(roles).where(eq(roles.id, id)).limit(1).then(res => res[0]);
    if (!role) return null;

    return {
      ...role,
      permissions: JSON.parse(role.permissions),
    };
  }

  async list() {
    const roleList = await this.db.select().from(roles);
    return roleList.map(role => ({
      ...role,
      permissions: JSON.parse(role.permissions),
    }));
  }
}

export interface CreateRoleInput {
  name: string;
  description?: string;
  permissions: RolePermissions;
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
  permissions?: RolePermissions;
} 