import { injectable, inject } from "tsyringe";
import { DataSource, ObjectLiteral, Repository } from "typeorm";
import { Review } from "../entities";
import { LogsService } from "./logs.service";
import { FormAnswer } from "../entities";
import { v4 as uuid } from 'uuid';
import { Newable, Service } from "./service";
import { TenantsService } from "./tenants.service";
import { UsersService } from "./users.service";

@injectable()
export class ReviewsService extends Service {
  private repositories: Map<Newable<any>, Repository<any>> = new Map();
  private conn: DataSource | null = null;

  static dependencies() {
    return [
      TenantsService,
      UsersService,
      LogsService
    ]
  }

  constructor(
    @inject(TenantsService) private tenantsService: TenantsService,
    @inject(UsersService) private usersService: UsersService,
    @inject(LogsService) private logs: LogsService
  ) {
    super();
  }

  async getRepository<T extends ObjectLiteral>(cls: Newable<T>): Promise<Repository<T>> {
    if (this.repositories.has(cls)) {
      return this.repositories.get(cls)!;
    }
    const conn = this.conn || (await this.tenantsService.getContextualPlatformDBClient());
    const repository = conn.getRepository(cls);
    this.repositories.set(cls, repository);
    return repository! as any;
  }

  async create(data: CreateReviewInput): Promise<Review> {
    const repository = await this.getRepository(Review);
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

    const savedReview = await repository.save(review);

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
    const user = await this.usersService.getSessionUser();
    const repository = await this.getRepository(Review);
    const review = await repository.findOne({
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
        review.completedBy = userId || user?.userId;
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

    const updatedReview = await repository.save(review);

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
    const repository = await this.getRepository(Review);
    const review = await repository.findOne({
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

    const updatedReview = await repository.save(review);

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
    const repository = await this.getRepository(Review);
    const formAnswerRepository = await this.getRepository(FormAnswer);
    const review = await repository.findOne({
      where: { id },
      relations: ['nodeExecution']
    });

    if (review) {
      // Fetch form instances and answers for each review item
      const answerIds = review.reviewItems.map(item => item.answer_id);
      const formAnswers = await formAnswerRepository.find({
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
    const repository = await this.getRepository(Review);
    return await repository.findOne({
      where: { nodeExecutionId },
      relations: ['nodeExecution']
    });
  }

  async list(filter?: ReviewsFilter): Promise<Review[]> {
    const repository = await this.getRepository(Review);
    try {
      const queryBuilder = repository.createQueryBuilder('review')
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
    const repository = await this.getRepository(Review);
    try {
      const reviews = await repository.find({
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
    const repository = await this.getRepository(Review);
    try {
      const result = await repository.delete(id);

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