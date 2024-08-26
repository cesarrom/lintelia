import { eq } from "drizzle-orm";
import { PlatformDB, reviews } from "../models/platform.sql";

export class ReviewsService {
  constructor(private readonly db: PlatformDB) { }

  async createReview(reviewData: typeof reviews.$inferInsert) {
    return await this.db.insert(reviews).values(reviewData).returning();
  }

  async getReviewById(id: number) {
    return await this.db
      .select()
      .from(reviews)
      .where(eq(reviews.id, id))
      .limit(1)
      .then((res) => res[0] || null);
  }

  async updateReview(id: number, reviewData: Partial<typeof reviews.$inferInsert>) {
    return await this.db
      .update(reviews)
      .set(reviewData)
      .where(eq(reviews.id, id))
      .returning();
  }

  async deleteReview(id: number) {
    return await this.db.delete(reviews).where(eq(reviews.id, id)).returning();
  }

  async getAllReviews() {
    return await this.db.select().from(reviews);
  }

}