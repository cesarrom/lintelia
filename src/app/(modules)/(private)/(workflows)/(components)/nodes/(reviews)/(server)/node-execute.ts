import { events, ReviewNodeData, ReviewNodeDataSchema } from "../types";
import * as restate from "@restatedev/restate-sdk/fetch";
import { ExecuteNodeFunctionProps } from "@/app/(modules)/(private)/(workflows)/types";
import { workflowInject } from "@/lib/injector/utils";
import { ReviewsService } from "@/lib/services/reviews.service";
import { LogsService } from "@/lib/services/logs.service";
import { WorkflowExecutionsService } from "@/lib/services";

export const reviewService = restate.object({
  name: "review",
  handlers: {
    executeNode: workflowInject(
      [ReviewsService, LogsService, WorkflowExecutionsService],
      async ({ }, [reviewsService, logsService, workflowExecutionsService], c: restate.ObjectContext, { executionId, nodeData, yaml, domain, token, result: r, resumableId, resumableResult }: ExecuteNodeFunctionProps) => {
        // Validate and parse the node configuration
        const config = await c.run('validate-config', async () => {
          return ReviewNodeDataSchema.parse(nodeData.config || {});
        });

        // Get interpolated variables using the workflow's result
        const variables = await c.run('get-variables', () => {
          return workflowExecutionsService.getConfiguration(config, r);
        }) as ReviewNodeData;

        if (resumableId) {

          if (!resumableResult) {
            throw new Error('Resumable result is missing');
          }

          const existingReview = await reviewsService.getById(resumableResult.reviewId as string);

          if (!existingReview) {
            throw new Error('Review not found');
          }

          await c.run('log-existing-review', async () => {
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
            return workflowExecutionsService.nextOrEndExecution({
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
            return workflowExecutionsService.nextOrEndExecution({
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
            return workflowExecutionsService.nextOrEndExecution({
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
          return workflowExecutionsService.nextOrEndExecution({
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
        // Create a new review
        const review = await c.run('create-review', async () => {
          const title = String(variables.title || '');
          const description = variables.description ? String(variables.description) : undefined;
          const timeoutInHours = variables.timeoutInHours ? Number(variables.timeoutInHours) : undefined;

          return reviewsService.create({
            nodeExecutionId: executionId,
            title,
            description,
            reviewItems: variables.items.map(i => ({
              answer_id: i.answer_id,
              label: i.label,
              required: i.required,
              order: i.order
            })),
            dueDate: timeoutInHours
              ? new Date(Date.now() + timeoutInHours * 60 * 60 * 1000)
              : undefined
          });
        });

        await c.run('log-review-created', async () => {
          await logsService.info('Review created successfully', {
            category: 'workflow',
            source: 'ReviewNodeServer',
            metadata: {
              reviewId: review.id,
              nodeExecutionId: executionId,
              itemCount: variables.items.length
            }
          });
        });

        const resumable = await c.run('create-resumable', async () => {
          return workflowExecutionsService.createResumable({
            nodeData,
            event: events.assigned,
            executionId,
            localResult: review as unknown as Record<string, unknown>,
            globalResult: r,
            yaml,
            domain,
            token,
            nextNodes: [nodeData]
          });
        });


        // Return the assigned event
        return workflowExecutionsService.nextOrEndExecution({
          nodeData,
          event: events.assigned,
          executionId,
          localResult: { review: review as unknown as Record<string, unknown>, resumableId: resumable },
          globalResult: r,
          yaml,
          domain,
          token
        });
      }
    ),
  }
});

export type ReviewService = typeof reviewService; 