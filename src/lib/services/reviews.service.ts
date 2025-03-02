import { inject, injectable } from "tsyringe";
import { DataSource, Repository, FindOptionsWhere, In } from "typeorm";
import { TENANT_DB_TOKEN, USER_TOKEN } from "../injector/tokens";
import { Review } from "../entities/tenant/review.entity";
import { User } from "@/types/auth";
import { LogsService } from "./logs.service";
import { WorkflowNodeExecution } from "../entities/tenant";

export interface CreateReviewInput {
  nodeExecutionId: string;
  title: string;
  description?: string;
  reviewItems: Array<{
    answer_id: string;
    label?: string;
  }>;
  assignToUser?: string;
  dueDate?: Date;
}

export interface UpdateReviewInput {
  status?: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'additional_data_requested';
  comments?: string;
  rejectionReason?: string;
  additionalDataRequest?: string;
  reviewItems?: Array<{
    answer_id: string;
    status: 'pending' | 'approved' | 'rejected';
    comments?: string;
  }>;
  evidence?: Array<{
    type: string;
    url: string;
    name: string;
    description?: string;
  }>;
}

export interface ReviewsFilter {
  status?: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'additional_data_requested';
  assignedTo?: string;
  nodeExecutionId?: string;
  fromDate?: Date;
  toDate?: Date;
}

@injectable()
export class ReviewsService {
  private repository: Repository<Review>;

  constructor(
    @inject(TENANT_DB_TOKEN) private conn: DataSource,
    @inject(USER_TOKEN) private user: User | null,
    @inject(LogsService) private logs: LogsService
  ) {
    this.repository = this.conn.getRepository(Review);
  }

  async create(data: CreateReviewInput): Promise<Review> {
    try {
      this.logs.info('Creating new review', {
        category: 'workflow',
        source: 'ReviewsService',
        metadata: {
          nodeExecutionId: data.nodeExecutionId,
          title: data.title
        }
      });

      const review = new Review();
      review.nodeExecutionId = data.nodeExecutionId;
      review.title = data.title;
      review.description = data.description;
      review.status = 'pending';
      review.reviewItems = data.reviewItems.map(item => ({
        answer_id: item.answer_id,
        label: item.label,
        status: 'pending' as const
      }));
      review.dueDate = data.dueDate;

      if (data.assignToUser) {
        review.assignedTo = data.assignToUser;
        review.assignedAt = new Date();
        review.status = 'in_progress';
      }

      const savedReview = await this.repository.save(review);

      this.logs.info('Review created successfully', {
        category: 'workflow',
        source: 'ReviewsService',
        metadata: {
          reviewId: savedReview.id
        }
      });

      return savedReview;
    } catch (error) {
      this.logs.error('Failed to create review', {
        category: 'workflow',
        source: 'ReviewsService',
        details: error instanceof Error ? error.message : String(error),
        metadata: {
          nodeExecutionId: data.nodeExecutionId
        }
      });
      throw error;
    }
  }

  async update(id: string, data: UpdateReviewInput, userId?: string): Promise<Review> {
    try {
      this.logs.info('Updating review', {
        category: 'workflow',
        source: 'ReviewsService',
        metadata: {
          reviewId: id,
          userId: userId || (this.user ? this.user.email : undefined)
        }
      });

      const review = await this.repository.findOneBy({ id });
      if (!review) {
        throw new Error(`Review with ID ${id} not found`);
      }

      // Update status if provided
      if (data.status) {
        review.status = data.status;
      }

      // Update comments if provided
      if (data.comments !== undefined) {
        review.comments = data.comments;
      }

      // Update rejection reason if provided
      if (data.rejectionReason !== undefined) {
        review.rejectionReason = data.rejectionReason;
      }

      // Update additional data request if provided
      if (data.additionalDataRequest !== undefined) {
        review.additionalDataRequest = data.additionalDataRequest;
      }

      // Update review items if provided
      if (data.reviewItems && data.reviewItems.length > 0) {
        // Create a map of existing items by answer_id for easier lookup
        const existingItemsMap = new Map(
          review.reviewItems.map(item => [item.answer_id, item])
        );

        // Update existing items or add new ones
        data.reviewItems.forEach(updatedItem => {
          const existingItem = existingItemsMap.get(updatedItem.answer_id);
          if (existingItem) {
            existingItem.status = updatedItem.status;
            if (updatedItem.comments !== undefined) {
              existingItem.comments = updatedItem.comments;
            }
          } else {
            review.reviewItems.push({
              answer_id: updatedItem.answer_id,
              status: updatedItem.status,
              comments: updatedItem.comments
            });
          }
        });
      }

      // Update evidence if provided
      if (data.evidence) {
        review.evidence = data.evidence;
      }

      // If status is changing to completed, set completed info
      if (
        (data.status === 'approved' || data.status === 'rejected') &&
        review.status !== 'approved' &&
        review.status !== 'rejected'
      ) {
        review.completedBy = userId || (this.user ? this.user.email : undefined);
        review.completedAt = new Date();
      }

      const savedReview = await this.repository.save(review);

      this.logs.info('Review updated successfully', {
        category: 'workflow',
        source: 'ReviewsService',
        metadata: {
          reviewId: id,
          status: savedReview.status
        }
      });

      return savedReview;
    } catch (error) {
      this.logs.error('Failed to update review', {
        category: 'workflow',
        source: 'ReviewsService',
        details: error instanceof Error ? error.message : String(error),
        metadata: {
          reviewId: id
        }
      });
      throw error;
    }
  }

  async assignReview(id: string, userId: string): Promise<Review> {
    try {
      const review = await this.repository.findOneBy({ id });
      if (!review) {
        throw new Error(`Review with ID ${id} not found`);
      }

      this.logs.info('Assigning review', {
        category: 'workflow',
        source: 'ReviewsService',
        metadata: {
          reviewId: id,
          userId
        }
      });

      review.assignedTo = userId;
      review.assignedAt = new Date();
      review.status = 'in_progress';

      const savedReview = await this.repository.save(review);

      this.logs.info('Review assigned successfully', {
        category: 'workflow',
        source: 'ReviewsService',
        metadata: {
          reviewId: id,
          userId
        }
      });

      return savedReview;
    } catch (error) {
      this.logs.error('Failed to assign review', {
        category: 'workflow',
        source: 'ReviewsService',
        details: error instanceof Error ? error.message : String(error),
        metadata: {
          reviewId: id,
          userId
        }
      });
      throw error;
    }
  }

  async getById(id: string): Promise<Review | null> {
    try {
      this.logs.info('Fetching review by ID', {
        category: 'workflow',
        source: 'ReviewsService',
        metadata: {
          reviewId: id
        }
      });

      const review = await this.repository.findOneBy({ id });

      if (!review) {
        this.logs.warning('Review not found', {
          category: 'workflow',
          source: 'ReviewsService',
          metadata: {
            reviewId: id
          }
        });
      }

      return review;
    } catch (error) {
      this.logs.error('Failed to fetch review by ID', {
        category: 'workflow',
        source: 'ReviewsService',
        details: error instanceof Error ? error.message : String(error),
        metadata: {
          reviewId: id
        }
      });
      throw error;
    }
  }

  async getByNodeExecutionId(nodeExecutionId: string): Promise<Review | null> {
    try {
      this.logs.info('Fetching review by node execution ID', {
        category: 'workflow',
        source: 'ReviewsService',
        metadata: {
          nodeExecutionId
        }
      });

      const review = await this.repository.findOneBy({ nodeExecutionId });

      if (!review) {
        this.logs.warning('Review not found for node execution', {
          category: 'workflow',
          source: 'ReviewsService',
          metadata: {
            nodeExecutionId
          }
        });
      }

      return review;
    } catch (error) {
      this.logs.error('Failed to fetch review by node execution ID', {
        category: 'workflow',
        source: 'ReviewsService',
        details: error instanceof Error ? error.message : String(error),
        metadata: {
          nodeExecutionId
        }
      });
      throw error;
    }
  }

  async list(filter?: ReviewsFilter): Promise<Review[]> {
    try {
      this.logs.info('Listing reviews', {
        category: 'workflow',
        source: 'ReviewsService',
        metadata: {
          filter
        }
      });

      const queryBuilder = this.repository.createQueryBuilder('review');

      // Apply filters if provided
      if (filter) {
        if (filter.status) {
          queryBuilder.andWhere('review.status = :status', { status: filter.status });
        }

        if (filter.assignedTo) {
          queryBuilder.andWhere('review.assignedTo = :assignedTo', { assignedTo: filter.assignedTo });
        }

        if (filter.nodeExecutionId) {
          queryBuilder.andWhere('review.nodeExecutionId = :nodeExecutionId', { nodeExecutionId: filter.nodeExecutionId });
        }

        if (filter.fromDate) {
          queryBuilder.andWhere('review.createdAt >= :fromDate', { fromDate: filter.fromDate });
        }

        if (filter.toDate) {
          queryBuilder.andWhere('review.createdAt <= :toDate', { toDate: filter.toDate });
        }
      }

      // Order by created date, newest first
      queryBuilder.orderBy('review.createdAt', 'DESC');

      const reviews = await queryBuilder.getMany();

      this.logs.info('Reviews fetched successfully', {
        category: 'workflow',
        source: 'ReviewsService',
        metadata: {
          count: reviews.length
        }
      });

      return reviews;
    } catch (error) {
      this.logs.error('Failed to list reviews', {
        category: 'workflow',
        source: 'ReviewsService',
        details: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async listByAssignee(userId: string): Promise<Review[]> {
    try {
      this.logs.info('Listing reviews by assignee', {
        category: 'workflow',
        source: 'ReviewsService',
        metadata: {
          userId
        }
      });

      const reviews = await this.repository.find({
        where: {
          assignedTo: userId
        },
        order: {
          createdAt: 'DESC'
        }
      });

      this.logs.info('Reviews by assignee fetched successfully', {
        category: 'workflow',
        source: 'ReviewsService',
        metadata: {
          userId,
          count: reviews.length
        }
      });

      return reviews;
    } catch (error) {
      this.logs.error('Failed to list reviews by assignee', {
        category: 'workflow',
        source: 'ReviewsService',
        details: error instanceof Error ? error.message : String(error),
        metadata: {
          userId
        }
      });
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      this.logs.info('Deleting review', {
        category: 'workflow',
        source: 'ReviewsService',
        metadata: {
          reviewId: id
        }
      });

      const result = await this.repository.delete(id);
      const success = result.affected ? result.affected > 0 : false;

      if (success) {
        this.logs.info('Review deleted successfully', {
          category: 'workflow',
          source: 'ReviewsService',
          metadata: {
            reviewId: id
          }
        });
      } else {
        this.logs.warning('Review not found for deletion', {
          category: 'workflow',
          source: 'ReviewsService',
          metadata: {
            reviewId: id
          }
        });
      }

      return success;
    } catch (error) {
      this.logs.error('Failed to delete review', {
        category: 'workflow',
        source: 'ReviewsService',
        details: error instanceof Error ? error.message : String(error),
        metadata: {
          reviewId: id
        }
      });
      throw error;
    }
  }
} 