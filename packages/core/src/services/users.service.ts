import { eq } from "drizzle-orm";
import { users } from "../models/platform.sql";
import { type PlatformDB } from "./tenants.service";
import { auth } from "../clients/auth.client";
import { Autowire, Injectable } from "ts-injection";
import { PLATFORM_DB_TOKEN } from "../libs/injector/tokens";
@Injectable()
export class UsersService {
  static roles = {
    admin: 'admin',
    reviewer: 'reviewer',
    user: 'user',
  };

  @Autowire(PLATFORM_DB_TOKEN)
  private db: PlatformDB;

  async createUser(userData: typeof users.$inferInsert & { phoneNumber: string }) {
    const [user] = await this.db.insert(users).values({
      ...userData,
    }).returning();

    return user;
  }

  async getUserById(id: string) {
    return await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)
      .then((res) => res[0] || null);
  }

  async updateUser(id: string, userData: Partial<typeof users.$inferInsert>) {
    return await this.db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
  }

  async deleteUser(id: string) {
    await auth.management.user.deleteByUserId(id);

    return await this.db.delete(users).where(eq(users.id, id)).returning();
  }

  async getAllUsers() {
    return await this.db.select().from(users);
  }

}