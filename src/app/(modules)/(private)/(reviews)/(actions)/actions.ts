'use server';

import { revalidatePath } from 'next/cache';
import { inject } from '@/lib/injector/utils';
import { ReviewsService } from '@/lib/services';
import { Review } from '@/lib/entities/tenant/review.entity';

// Get all reviews with optional filtering
export const getReviews = inject(
  [ReviewsService],
  async (_, [reviewsService], filter?: {
    status?: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'additional_data_requested';
    assignedTo?: string;
    fromDate?: Date;
    toDate?: Date;
  }) => {
    const reviews = await reviewsService.list(filter);
    revalidatePath('/reviews');
    return reviews;
  }
);

// Get reviews assigned to a specific user
export const getAssignedReviews = inject(
  [ReviewsService],
  async (_, [reviewsService], userId: string) => {
    const reviews = await reviewsService.listByAssignee(userId);
    revalidatePath('/my-reviews');
    return reviews;
  }
);

// Get a single review by ID
export const getReview = inject(
  [ReviewsService],
  async (_, [reviewsService], id: string) => {
    return reviewsService.getById(id);
  }
);

// Get a review by node execution ID
export const getReviewByNodeExecution = inject(
  [ReviewsService],
  async (_, [reviewsService], nodeExecutionId: string) => {
    return reviewsService.getByNodeExecutionId(nodeExecutionId);
  }
);

// Assign a review to a user
export const assignReview = inject(
  [ReviewsService],
  async (_, [reviewsService], id: string, userId: string) => {
    const review = await reviewsService.assignReview(id, userId);
    revalidatePath('/reviews');
    revalidatePath('/my-reviews');
    revalidatePath(`/reviews/${id}`);
    return review;
  }
);

// Update a review's status and details
export const updateReview = inject(
  [ReviewsService],
  async (_, [reviewsService], id: string, data: {
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
  }, userId?: string) => {
    const review = await reviewsService.update(id, data, userId);
    revalidatePath('/reviews');
    revalidatePath('/my-reviews');
    revalidatePath(`/reviews/${id}`);
    return review;
  }
);

// Approve a review
export const approveReview = inject(
  [ReviewsService],
  async (_, [reviewsService], id: string, data: {
    comments?: string;
    reviewItems?: Array<{
      answer_id: string;
      status: 'approved' | 'rejected';
      comments?: string;
    }>;
  }, userId?: string) => {
    const review = await reviewsService.update(id, {
      status: 'approved',
      comments: data.comments,
      reviewItems: data.reviewItems
    }, userId);
    
    revalidatePath('/reviews');
    revalidatePath('/my-reviews');
    revalidatePath(`/reviews/${id}`);
    return review;
  }
);

// Reject a review
export const rejectReview = inject(
  [ReviewsService],
  async (_, [reviewsService], id: string, data: {
    rejectionReason: string;
    comments?: string;
    reviewItems?: Array<{
      answer_id: string;
      status: 'approved' | 'rejected';
      comments?: string;
    }>;
    evidence?: Array<{
      type: string;
      url: string;
      name: string;
      description?: string;
    }>;
  }, userId?: string) => {
    const review = await reviewsService.update(id, {
      status: 'rejected',
      rejectionReason: data.rejectionReason,
      comments: data.comments,
      reviewItems: data.reviewItems,
      evidence: data.evidence
    }, userId);
    
    revalidatePath('/reviews');
    revalidatePath('/my-reviews');
    revalidatePath(`/reviews/${id}`);
    return review;
  }
);

// Request additional data for a review
export const requestAdditionalData = inject(
  [ReviewsService],
  async (_, [reviewsService], id: string, data: {
    additionalDataRequest: string;
    comments?: string;
  }, userId?: string) => {
    const review = await reviewsService.update(id, {
      status: 'additional_data_requested',
      additionalDataRequest: data.additionalDataRequest,
      comments: data.comments
    }, userId);
    
    revalidatePath('/reviews');
    revalidatePath('/my-reviews');
    revalidatePath(`/reviews/${id}`);
    return review;
  }
);

// Delete a review
export const deleteReview = inject(
  [ReviewsService],
  async (_, [reviewsService], id: string) => {
    const success = await reviewsService.delete(id);
    revalidatePath('/reviews');
    revalidatePath('/my-reviews');
    return success;
  }
);
