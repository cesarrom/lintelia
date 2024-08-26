import { eq } from "drizzle-orm";
import { PlatformDB, files } from "../models/platform.sql";

export class FilesService {
  constructor(private readonly db: PlatformDB) { }

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