import { eq } from "drizzle-orm";
import { files } from "../models/platform.sql";
import { type PlatformDB } from "./tenants.service";
import { PLATFORM_DB_TOKEN } from "../libs/injector/tokens";
import { Autowire, Injectable } from "ts-injection";

@Injectable()
export class FilesService {
  @Autowire(PLATFORM_DB_TOKEN)
  private db: PlatformDB

  async createFile(fileData: typeof files.$inferInsert) {
    return await this.db.insert(files).values(fileData).returning();
  }

  async getFileById(id: number) {
    return await this.db
      .select()
      .from(files)
      .where(eq(files.id, id))
      .limit(1)
      .then((res) => res[0] || null);
  }

  async updateFile(id: number, fileData: Partial<typeof files.$inferInsert>) {
    return await this.db
      .update(files)
      .set(fileData)
      .where(eq(files.id, id))
      .returning();
  }

  async deleteFile(id: number) {
    return await this.db.delete(files).where(eq(files.id, id)).returning();
  }

  async getAllFiles() {
    return await this.db.select().from(files);
  }
}