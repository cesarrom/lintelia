import { events, ReviewNodeDataSchema } from "../types";
import * as restate from "@restatedev/restate-sdk/fetch";
import { nextOrEndExecution, getConfiguration } from "@/lib/restate-utils";
import { ExecuteNodeFunctionProps } from "../../(workflows)/types";
import { inject } from "@/lib/injector/utils";
import { ReviewsService } from "@/lib/services/reviews.service";
import { LogsService } from "@/lib/services/logs.service";

export const reviewService = restate.object({
  name: "review",
  handlers: {
    executeNode: async (c: restate.ObjectContext, { executionId, nodeData, yaml, domain, token, result: r }: ExecuteNodeFunctionProps) => {
      // Validate and parse the node configuration
      const config = await c.run('validate-config', async () => {
        return ReviewNodeDataSchema.parse(nodeData.config || {});
      });

      // Get interpolated variables using the workflow's result
      const variables = await c.run('get-variables', () => {
        return getConfiguration(c, executionId, config, r);
      });

      // Check if a review already exists for this node execution
      const existingReview = await c.run('check-existing-review', async () => {
        const reviewsService = await inject([ReviewsService], ({ }, [service]) => service)({ 
          domain,
          token
        });
        
        return reviewsService.getByNodeExecutionId(executionId);
      });
      
      if (existingReview) {
        await c.run('log-existing-review', async () => {
          const logsService = await inject([LogsService], ({ }, [service]) => service)({ 
            domain,
            token
          });
          
          await logsService.info('Review already exists for this node execution', {
            category: 'workflow',
            source: 'ReviewNodeServer',
            metadata: {
              reviewId: existingReview.id,
              status: existingReview.status,
              nodeExecutionId: executionId
            }
          });
        });

        // If the review is completed, return the appropriate event
        if (existingReview.status === 'approved') {
          return nextOrEndExecution(c, { 
            nodeData, 
            event: events.approved, 
            executionId, 
            localResult: existingReview as unknown as Record<string, unknown>, 
            globalResult: r, 
            yaml, 
            domain, 
            token 
          });
        } else if (existingReview.status === 'rejected') {
          return nextOrEndExecution(c, { 
            nodeData, 
            event: events.rejected, 
            executionId, 
            localResult: existingReview as unknown as Record<string, unknown>, 
            globalResult: r, 
            yaml, 
            domain, 
            token 
          });
        } else if (existingReview.status === 'additional_data_requested') {
          return nextOrEndExecution(c, { 
            nodeData, 
            event: events.additionalDataRequested, 
            executionId, 
            localResult: existingReview as unknown as Record<string, unknown>, 
            globalResult: r, 
            yaml, 
            domain, 
            token 
          });
        }

        // If the review is still pending or in progress, return the assigned event
        return nextOrEndExecution(c, { 
          nodeData, 
          event: events.assigned, 
          executionId, 
          localResult: existingReview as unknown as Record<string, unknown>, 
          globalResult: r, 
          yaml, 
          domain, 
          token 
        });
      }

      // Collect review items from the workflow context
      const reviewItems = await c.run('collect-review-items', async () => {
        const items = [];
        const itemsArray = Array.isArray(variables.items) ? variables.items : [];
        
        for (const item of itemsArray) {
          try {
            // Get the data for this item from the workflow context
            const itemData = r[item.sourceId];
            
            items.push({
              type: item.type,
              sourceId: item.sourceId,
              label: item.label,
              data: itemData || null
            });
          } catch (error) {
            const logsService = await inject([LogsService], ({ }, [service]) => service)({ 
              domain,
              token
            });
            
            await logsService.error(`Failed to get data for review item ${item.sourceId}`, {
              category: 'workflow',
              source: 'ReviewNodeServer',
              metadata: {
                nodeId: nodeData.id,
                executionId,
                itemType: item.type,
                itemSourceId: item.sourceId,
                error: error instanceof Error ? error.message : String(error)
              }
            });
            
            items.push({
              type: item.type,
              sourceId: item.sourceId,
              label: item.label,
              data: null
            });
          }
        }
        
        return items;
      });

      // Create a new review
      const review = await c.run('create-review', async () => {
        const reviewsService = await inject([ReviewsService], ({ }, [service]) => service)({ 
          domain,
          token
        });
        
        const title = String(variables.title || '');
        const description = variables.description ? String(variables.description) : undefined;
        const timeoutInHours = variables.timeoutInHours ? Number(variables.timeoutInHours) : undefined;
        
        return reviewsService.create({
          nodeExecutionId: executionId,
          title,
          description,
          reviewItems,
          dueDate: timeoutInHours 
            ? new Date(Date.now() + timeoutInHours * 60 * 60 * 1000) 
            : undefined
        });
      });

      await c.run('log-review-created', async () => {
        const logsService = await inject([LogsService], ({ }, [service]) => service)({ 
          domain,
          token
        });
        
        await logsService.info('Review created successfully', {
          category: 'workflow',
          source: 'ReviewNodeServer',
          metadata: {
            reviewId: review.id,
            nodeExecutionId: executionId,
            itemCount: reviewItems.length
          }
        });
      });

      // Return the assigned event
      return nextOrEndExecution(c, { 
        nodeData, 
        event: events.assigned, 
        executionId, 
        localResult: review as unknown as Record<string, unknown>, 
        globalResult: r, 
        yaml, 
        domain, 
        token 
      });
    }
  }
});

export type ReviewService = typeof reviewService; 