import { createEvent } from './create-event';
import { LogCategory, LogLevel, Review, ReviewStatus, TriggerDefinition } from '../../schemas';
import { EntityType, BaseEventData, ListenerConfig } from './types';

/**
 * Base interface for all review-related events
 */
interface BaseReviewEventData extends BaseEventData {
  // The ID of the review this event is about
  reviewId: string;
  // The ID of the tenant this event belongs to
  tenantId: string;
  // The user who triggered the event
  userId: string;
  // Additional metadata
  [key: string]: unknown;
}

/**
 * Review request events
 */
export interface ReviewRequestEventData extends BaseReviewEventData {
  // The ID of the document being reviewed
  documentId: string;
  // The IDs of the reviewers
  reviewers: string[];
  // The ID of the user who requested the review
  requestedBy: string;
  // Optional due date for the review
  dueDate?: string;
  // Optional instructions for the review
  instructions?: string;
  // The status of the review
  status: ReviewStatus;
}

/**
 * Review action events (approve, reject, etc.)
 */
export interface ReviewActionEventData extends BaseReviewEventData {
  // The ID of the reviewer who took the action
  reviewerId: string;
  // The ID of the review item (if applicable)
  reviewItemId?: string;
  // Optional comment from the reviewer
  comment?: string;
  // The action taken (e.g., 'approved', 'rejected', 'commented')
  action: string;
  // The status of the review after this action
  status: ReviewStatus;
}

/**
 * Review comment events
 */
export interface ReviewCommentEventData extends BaseReviewEventData {
  // The ID of the comment
  commentId: string;
  // The ID of the reviewer who added the comment
  reviewerId: string;
  // The content of the comment
  content: string;
  // The ID of the parent comment (for threaded comments)
  parentCommentId?: string;
  // Whether the comment is a reply to another comment
  isReply: boolean;
}

/**
 * Configuration for review event listeners
 */
export interface ReviewListenerConfig<T extends BaseReviewEventData>
  extends Omit<ListenerConfig<T>, 'where' | 'entityType' | 'entityId'> {
  // Filter by review ID
  reviewId?: string | string[] | RegExp;
  // Filter by document ID
  documentId?: string | string[] | RegExp;
  // Filter by reviewer ID
  reviewerId?: string | string[] | RegExp;
  // Filter by review status
  status?: ReviewStatus | ReviewStatus[];
  // Filter by tenant ID
  tenantId?: string | string[];
  // Additional custom filters
  where?: Partial<T>;
}

/**
 * Creates a review event with proper entity references
 */
function createReviewEvent<T extends BaseReviewEventData>(
  name: string,
  category: LogCategory,
  level: LogLevel,
  getEntityId: (data: Review) => { reviewId: string } | undefined = (data) => ({ reviewId: data.id! })
) {
  return createEvent<Review, ListenerConfig<T>, { reviewId: string }>({
    name,
    category,
    level,
    source: 'review-service',
    getEntityRef: getEntityId,
  });
}

/**
 * Helper function to create a review event listener
 * @param event The review event to listen for
 * @param config Configuration for the listener
 * @param workflowId The ID of the workflow to trigger
 * @returns A trigger definition that can be used to listen for the event
 */
export function createReviewListener<T extends BaseReviewEventData>(
  event: {
    createListener: (config: ListenerConfig<T>, workflowId: string) => TriggerDefinition;
  },
  config: ReviewListenerConfig<T>,
  workflowId: string
): TriggerDefinition {
  const { reviewId, documentId, reviewerId, status, tenantId, where, ...rest } = config;

  const listenerConfig: ListenerConfig<T> = {
    ...rest,
    entityType: EntityType.REVIEW,
    where: {
      ...(reviewId && { reviewId }),
      ...(documentId && { documentId }),
      ...(reviewerId && { reviewerId }),
      ...(status && { status }),
      ...(tenantId && { tenantId }),
      ...where,
    } as Partial<T>,
  };

  return event.createListener(listenerConfig, workflowId);
}

export const ReviewEvents = {
  // Review Requests
  ReviewRequested: createReviewEvent<ReviewRequestEventData & {
    reviewers: string[];
    requestedBy: string;
    dueDate?: string;
    instructions?: string;
  }>(
    'review.requested',
    'review' as LogCategory,
    'info' as LogLevel
  ),

  ReviewStarted: createReviewEvent<ReviewActionEventData>(
    'review.started',
    'review' as LogCategory,
    'info' as LogLevel
  ),

  // Review Actions
  ReviewApproved: createReviewEvent<ReviewActionEventData>(
    'review.approved',
    'review' as LogCategory,
    'info' as LogLevel
  ),

  ReviewRejected: createReviewEvent<ReviewActionEventData & {
    reason: string;
  }>(
    'review.rejected',
    'review' as LogCategory,
    'warning' as LogLevel
  ),

  // Review Comments
  ReviewCommented: createReviewEvent<ReviewCommentEventData>(
    'review.commented',
    'review' as LogCategory,
    'info' as LogLevel
  ),

  ReviewCommentUpdated: createReviewEvent<ReviewCommentEventData>(
    'review.comment.updated',
    'review' as LogCategory,
    'info' as LogLevel
  ),

  ReviewCommentDeleted: createReviewEvent<ReviewCommentEventData & {
    deletedBy: string;
  }>(
    'review.comment.deleted',
    'review' as LogCategory,
    'warning' as LogLevel
  ),

  // Review Status Changes
  ReviewStatusChanged: createReviewEvent<BaseReviewEventData & {
    previousStatus: string;
    newStatus: string;
    changedBy: string;
    reason?: string;
  }>(
    'review.status.changed',
    'review' as LogCategory,
    'info' as LogLevel
  ),

  ReviewCompleted: createReviewEvent<BaseReviewEventData & {
    completedBy: string;
    status: 'approved' | 'rejected';
    comment?: string;
  }>(
    'review.completed',
    'review' as LogCategory,
    'info' as LogLevel
  ),

  // Review Reminders
  ReviewReminderSent: createReviewEvent<BaseReviewEventData & {
    reviewerId: string;
    reminderType: 'first' | 'follow_up' | 'final';
  }>(
    'review.reminder_sent',
    'review' as LogCategory,
    'info' as LogLevel
  ),

  // Review Items
  ReviewItemAdded: createReviewEvent<BaseReviewEventData & {
    itemId: string;
    type: string;
    addedBy: string;
  }>(
    'review.item.added',
    'review' as LogCategory,
    'info' as LogLevel
  ),

  ReviewItemUpdated: createReviewEvent<BaseReviewEventData & {
    itemId: string;
    changes: Record<string, unknown>;
    updatedBy: string;
  }>(
    'review.item.updated',
    'review' as LogCategory,
    'info' as LogLevel
  ),

  ReviewItemRemoved: createReviewEvent<BaseReviewEventData & {
    itemId: string;
    removedBy: string;
    reason?: string;
  }>(
    'review.item.removed',
    'review' as LogCategory,
    'warning' as LogLevel
  ),
};
