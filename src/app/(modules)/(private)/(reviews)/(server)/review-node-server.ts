import * as restate from '@restatedev/restate-sdk/fetch';
import { inject } from '@/lib/injector/utils';
import { ReviewsService, LogsService } from '@/lib/services';
import { ReviewNodeDataSchema, events } from '../types';

export const reviewService = restate.object({
  name: 'review-node',
  handlers: {
    async executeNode(
      context: restate.ObjectContext,
      nodeExecutionId: string,
      nodeData: unknown,
      workflowContext: Record<string, unknown>
    ) {
      try {
        // Parse and validate the node configuration
        const parsedConfig = ReviewNodeDataSchema.safeParse(nodeData);
        if (!parsedConfig.success) {
          context.logger.error('Invalid review node configuration', {
            nodeExecutionId,
            errors: parsedConfig.error.format()
          });
          return { event: 'error', data: { error: 'Invalid node configuration' } };
        }

        const config = parsedConfig.data;
        
        // Get variables from the workflow context
        const variables = {
          title: config.title,
          description: config.description || '',
          items: config.items || [],
          assignToRoles: config.assignToRoles || [],
          timeoutInHours: config.timeoutInHours
        };

        // Check if a review already exists for this node execution
        const reviewsService = await inject([ReviewsService], (_, [service]) => service)();
        const logsService = await inject([LogsService], (_, [service]) => service)();
        
        const existingReview = await reviewsService.getByNodeExecutionId(nodeExecutionId);
        
        // If a review already exists, return the appropriate event based on its status
        if (existingReview) {
          context.logger.info('Review already exists for this node execution', {
            nodeExecutionId,
            reviewId: existingReview.id,
            status: existingReview.status
          });

          // Cast to Record to avoid TypeScript errors
          const reviewData = existingReview as Record<string, unknown>;
          
          switch (existingReview.status) {
            case 'approved':
              return { event: events.approved, data: { review: reviewData } };
            case 'rejected':
              return { event: events.rejected, data: { review: reviewData } };
            case 'additional_data_requested':
              return { event: events.additionalDataRequested, data: { review: reviewData } };
            case 'pending':
            case 'in_progress':
            default:
              return { event: events.assigned, data: { review: reviewData } };
          }
        }

        // If no review exists, create a new one
        context.logger.info('Creating new review', {
          nodeExecutionId,
          title: variables.title
        });

        // Collect form answers from the workflow context
        const reviewItems = [];
        const itemsArray = Array.isArray(variables.items) ? variables.items : [];
        
        for (const item of itemsArray) {
          if (!item.answer_id) {
            context.logger.warn('Review item missing answer_id', { item });
            continue;
          }

          reviewItems.push({
            answer_id: item.answer_id,
            label: item.label
          });
        }

        // Create the review
        const review = await reviewsService.create({
          nodeExecutionId,
          title: variables.title,
          description: variables.description,
          reviewItems,
          dueDate: variables.timeoutInHours 
            ? new Date(Date.now() + variables.timeoutInHours * 60 * 60 * 1000) 
            : undefined
        });

        // Log the successful creation
        await logsService.info('Review created successfully', {
          category: 'workflow',
          source: 'ReviewNodeServer',
          metadata: {
            reviewId: review.id,
            nodeExecutionId
          }
        });

        // Return the assigned event
        return { 
          event: events.assigned, 
          data: { review: review as Record<string, unknown> } 
        };
      } catch (error) {
        context.logger.error('Error executing review node', {
          nodeExecutionId,
          error: error instanceof Error ? error.message : String(error)
        });
        return { event: 'error', data: { error: error instanceof Error ? error.message : String(error) } };
      }
    }
  }
});

export type ReviewService = typeof reviewService; 