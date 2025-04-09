import { injectable, inject } from "tsyringe";
import { DataSource, Repository } from "typeorm";
import { TENANT_DB_TOKEN, USER_TOKEN } from "../injector/tokens";
import { Review } from "../entities/tenant/review.entity";
import { LogsService } from "./logs.service";
import { User } from "@/types/auth";
import { FormInstance, FormAnswer } from "../entities/tenant";
import { v4 as uuid } from 'uuid';

@injectable()
export class ReviewsService {
  private repository: Repository<Review>;
  private formInstanceRepository: Repository<FormInstance>;
  private formAnswerRepository: Repository<FormAnswer>;

  constructor(
    @inject(TENANT_DB_TOKEN) private conn: DataSource,
    @inject(USER_TOKEN) private user: User | null,
    @inject(LogsService) private logs: LogsService
  ) {
    this.repository = this.conn.getRepository(Review);
    this.formInstanceRepository = this.conn.getRepository(FormInstance);
    this.formAnswerRepository = this.conn.getRepository(FormAnswer);
  }

  async create(data: CreateReviewInput): Promise<Review> {
    const review = new Review();
    review.id = uuid();
    review.nodeExecutionId = data.nodeExecutionId;
    review.title = data.title;
    review.description = data.description;
    review.reviewItems = data.reviewItems.map(item => ({
      answer_id: item.answer_id,
      label: item.label,
      status: 'pending'
    }));

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
        nodeExecutionId: data.nodeExecutionId
      }
    });

    const savedReview = await this.repository.save(review);

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
    const review = await this.repository.findOne({
      where: { id }
    });

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
        review.completedBy = userId || this.user?.userId;
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

    const updatedReview = await this.repository.save(review);

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
    const review = await this.repository.findOne({
      where: { id }
    });

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

    const updatedReview = await this.repository.save(review);

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
    const review = await this.repository.findOne({
      where: { id },
      relations: ['nodeExecution']
    });

    if (review) {
      // Fetch form instances and answers for each review item
      const answerIds = review.reviewItems.map(item => item.answer_id);
      const formAnswers = await this.formAnswerRepository.find({
        where: { id: { $in: answerIds } as any },
        relations: ['formInstance', 'formInstance.form']
      });

      // Attach form data to review items
      review.reviewItems = review.reviewItems.map(item => {
        const answer = formAnswers.find(a => a.id === item.answer_id);
        return {
          ...item,
          formData: answer ? {
            form: answer.formInstance.form,
            instance: answer.formInstance,
            answer: answer
          } : undefined
        };
      });
    }

    return review;
  }

  async getByNodeExecutionId(nodeExecutionId: string): Promise<Review | null> {
    return await this.repository.findOne({
      where: { nodeExecutionId },
      relations: ['nodeExecution']
    });
  }

  async list(filter?: ReviewsFilter): Promise<Review[]> {
    try {
      const queryBuilder = this.repository.createQueryBuilder('review')
        .leftJoinAndSelect('review.nodeExecution', 'nodeExecution')
        .orderBy('review.createdAt', 'DESC');

      if (filter?.status) {
        queryBuilder.andWhere('review.status = :status', { status: filter.status });
      }

      if (filter?.assignedTo) {
        queryBuilder.andWhere('review.assignedTo = :assignedTo', { assignedTo: filter.assignedTo });
      }

      if (filter?.nodeExecutionId) {
        queryBuilder.andWhere('review.nodeExecutionId = :nodeExecutionId', { nodeExecutionId: filter.nodeExecutionId });
      }

      if (filter?.fromDate) {
        queryBuilder.andWhere('review.createdAt >= :fromDate', { fromDate: filter.fromDate });
      }

      if (filter?.toDate) {
        queryBuilder.andWhere('review.createdAt <= :toDate', { toDate: filter.toDate });
      }

      const reviews = await queryBuilder.getMany();

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
      const reviews = await this.repository.find({
        where: { assignedTo: userId },
        relations: ['nodeExecution'],
        order: { createdAt: 'DESC' }
      });

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
      const result = await this.repository.delete(id);
      
      await this.logs.info('Deleted review', {
        category: 'review',
        metadata: { reviewId: id }
      });

      return result.affected ? result.affected > 0 : false;
    } catch (error) {
      await this.logs.error('Failed to delete review', {
        category: 'review',
        metadata: { reviewId: id, error }
      });
      throw error;
    }
  }
}

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