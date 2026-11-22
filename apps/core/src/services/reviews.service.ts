import { sysFormAnswers, sysFormInstances, sysForms, sysReviews } from "../entities/tenants";
import { LogsService } from "./logs.service";
import { v4 as uuid } from 'uuid';
import { AbstractService } from "./service";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { WebService } from "./web.service";
import { CreateReviewInput, GetReviewsRequest, Review, ReviewsFilter, UpdateReviewInput } from "@repo/lintelia/schemas";
import { TENANT_CONNECTION } from "../injector/tokens/tenant-connection.token";
import { type TenantDatabase } from "../clients/database.client";
import { Injectable, Inject, Scope } from "@nestjs/common";

@Injectable({
  scope: Scope.REQUEST
})
export class ReviewsService extends AbstractService {

  constructor(
    @Inject(TENANT_CONNECTION) private db: TenantDatabase,
    @Inject(LogsService) private logs: LogsService,
    @Inject(WebService) private webService: WebService,
  ) {
    super();
  }

  async create(data: CreateReviewInput): Promise<Review> {
    const review = {
      id: uuid(),
      title: data.title,
      description: data.description || '',
      reviewItems: data.reviewItems.map(item => ({
        answer_id: item.answer_id,
        label: item.label,
        status: 'pending'
      })),
    } as Review;

    if (data.assignToUser) {
      review.assignedTo = data.assignToUser;
      review.assignedAt = new Date();
      review.status = 'in_progress';
    }

    if (data.dueDate) {
      review.dueDate = data.dueDate;
    }

    await this.logs.info('Creating new review', {
      category: 'review',
      source: 'ReviewsService',
      metadata: {
        reviewId: review.id,
      }
    });

    const [savedReview] = await this.db.insert(sysReviews).values(review).returning().execute();

    await this.logs.info('Review created', {
      category: 'review',
      source: 'ReviewsService',
      metadata: {
        reviewId: savedReview.id,
        title: savedReview.title
      }
    });

    return savedReview;
  }

  async update(id: string, data: UpdateReviewInput, userId?: string): Promise<Review> {
    const user = await this.webService.getSessionUser();
    const [review] = await this.db.select().from(sysReviews).where(eq(sysReviews.id, id)).execute();

    if (!review) {
      await this.logs.error('Review not found for update', {
        category: 'review',
        source: 'ReviewsService',
        metadata: { reviewId: id }
      });
      throw new Error("Review not found");
    }

    if (data.status) {
      review.status = data.status;
      if (data.status === 'approved' || data.status === 'rejected') {
        review.completedBy = userId || user?.userId || 'system';
        review.completedAt = new Date();
      }
    }

    if (data.comments !== undefined) {
      review.comments = data.comments;
    }

    if (data.rejectionReason !== undefined) {
      review.rejectionReason = data.rejectionReason;
    }

    if (data.additionalDataRequest !== undefined) {
      review.additionalDataRequest = data.additionalDataRequest;
    }

    if (data.reviewItems) {
      review.reviewItems = review.reviewItems.map(item => {
        const update = data.reviewItems?.find(u => u.answer_id === item.answer_id);
        if (update) {
          return {
            ...item,
            status: update.status,
            comments: update.comments
          };
        }
        return item;
      });
    }

    if (data.evidence) {
      review.evidence = data.evidence;
    }

    await this.logs.info('Updating review', {
      category: 'review',
      source: 'ReviewsService',
      metadata: {
        reviewId: review.id,
        changes: data
      }
    });

    const [updatedReview] = await this.db.update(sysReviews).set(review).where(eq(sysReviews.id, id)).returning().execute();

    await this.logs.info('Review updated', {
      category: 'review',
      source: 'ReviewsService',
      metadata: {
        reviewId: id,
        status: updatedReview.status
      }
    });

    return updatedReview;
  }

  async assignReview(id: string, userId: string): Promise<Review> {
    const [review] = await this.db.select().from(sysReviews).where(eq(sysReviews.id, id)).execute();

    if (!review) {
      await this.logs.error('Review not found for assignment', {
        category: 'review',
        source: 'ReviewsService',
        metadata: { reviewId: id }
      });
      throw new Error("Review not found");
    }

    review.assignedTo = userId;
    review.assignedAt = new Date();
    review.status = 'in_progress';

    await this.logs.info('Assigning review', {
      category: 'review',
      source: 'ReviewsService',
      metadata: {
        reviewId: review.id,
        assignedTo: userId
      }
    });

    const [updatedReview] = await this.db.update(sysReviews).set(review).where(eq(sysReviews.id, id)).returning().execute();

    await this.logs.info('Review assigned', {
      category: 'review',
      source: 'ReviewsService',
      metadata: {
        reviewId: id,
        assignedTo: userId
      }
    });

    return updatedReview;
  }

  async getById(id: string): Promise<Review | null> {
    const [review] = await this.db.select().from(sysReviews).where(eq(sysReviews.id, id)).execute();

    if (review) {
      // Fetch form instances and answers for each review item
      const answerIds = review.reviewItems.map(item => item.answer_id);
      const formAnswers = await this.db.select()
        .from(sysFormAnswers)
        .innerJoin(sysFormInstances, eq(sysFormAnswers.formInstanceId, sysFormInstances.id))
        .innerJoin(sysForms, eq(sysFormInstances.formId, sysForms.id))
        .where(inArray(sysFormAnswers.id, answerIds))
        .execute();

      // Attach form data to review items
      review.reviewItems = review.reviewItems.map(item => {
        const answer = formAnswers.find(a => a.sys_form_answers.id === item.answer_id);
        return {
          ...item,
          formData: answer ? {
            form: answer.sys_forms,
            instance: answer.sys_form_instances,
            answer: answer
          } : undefined
        };
      });
    }

    return review;
  }

  async list(filter?: ReviewsFilter | GetReviewsRequest): Promise<Review[]> {
    try {
      const conditions = [
        filter?.status ? eq(sysReviews.status, filter.status as typeof sysReviews.$inferSelect.status) : undefined,
        filter?.assignedTo ? eq(sysReviews.assignedTo, filter.assignedTo) : undefined,
        filter?.fromDate ? gte(sysReviews.createdAt, new Date(filter.fromDate)) : undefined,
        filter?.toDate ? lte(sysReviews.createdAt, new Date(filter.toDate)) : undefined,
      ];

      const reviews = await this.db.select().from(sysReviews).where(and(...conditions)).execute();

      await this.logs.info('Listed reviews', {
        category: 'review',
        metadata: { filter }
      });

      return reviews;
    } catch (error) {
      await this.logs.error('Failed to list reviews', {
        category: 'review',
        metadata: { filter, error }
      });
      throw error;
    }
  }

  async listByAssignee(userId: string): Promise<Review[]> {
    try {
      const reviews = await this.db.select().from(sysReviews).where(eq(sysReviews.assignedTo, userId)).execute();

      await this.logs.info('Listed reviews by assignee', {
        category: 'review',
        metadata: { userId }
      });

      return reviews;
    } catch (error) {
      await this.logs.error('Failed to list reviews by assignee', {
        category: 'review',
        metadata: { userId, error }
      });
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const { length: affected } = await this.db.delete(sysReviews).where(eq(sysReviews.id, id)).returning().execute();

      await this.logs.info('Deleted review', {
        category: 'review',
        metadata: { reviewId: id }
      });

      return affected > 0;
    } catch (error) {
      await this.logs.error('Failed to delete review', {
        category: 'review',
        metadata: { reviewId: id, error }
      });
      throw error;
    }
  }
}