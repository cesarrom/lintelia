import { eq } from "drizzle-orm";
import { PlatformDB, users } from "../models/platform.sql";

export class UsersService {
  constructor(private readonly db: PlatformDB) {}

  async createUser(userData: typeof users.$inferInsert) {
      return await this.db.insert(users).values(userData).returning();
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
      return await this.db.delete(users).where(eq(users.id, id)).returning();
    }
  
    async getAllUsers() {
      return await this.db.select().from(users);
    }
  
}