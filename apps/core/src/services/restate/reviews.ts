import { reviewNodeConfigSchema, ReviewNodeConfig, WORKFLOW_EVENTS, type User, GetReviewsRequest, UpdateReviewsRequest, ApproveReviewRequest, RejectReviewRequest, RequestAdditionalDataRequest, CreateReviewRequest } from "@repo/fintivio/schemas";
import { type ObjectContext, object } from "@restatedev/restate-sdk/fetch";
import { ReviewsService } from "../../services/reviews.service";
import { LogsService } from "../../services/logs.service";
import { WorkflowExecutionsService } from "../../services/workflow-executions.service";
import { ExecuteNodeFunctionProps } from "../../utils/restate-utils";
import { RestateService } from "./restate.abstract.service";
import { USER } from "../../injector/tokens/user.token";
import { Inject, Scope, Injectable } from "@nestjs/common";

@Injectable({
  scope: Scope.REQUEST
})
export class ReviewService extends RestateService<'review'> {
  object = object({
    name: "review",
    handlers: {
      executeNode: async (c: ObjectContext, { executionId, nodeData, workflowId, domain, token, result: r, resumableId, resumableResult }: ExecuteNodeFunctionProps) => {
        // Validate and parse the node configuration
        const config = await c.run('validate-config', async () => {
          return reviewNodeConfigSchema.parse(nodeData.config || {});
        });

        // Get interpolated variables using the workflow's result
        const variables = await c.run('get-variables', () => {
          return this.workflowExecutionsService.getConfiguration(config, r);
        }) as ReviewNodeConfig;

        if (resumableId) {

          if (!resumableResult) {
            throw new Error('Resumable result is missing');
          }

          const existingReview = await this.reviewsService.getById(resumableResult.reviewId as string);

          if (!existingReview) {
            throw new Error('Review not found');
          }

          await c.run('log-existing-review', async () => {
            await this.logsService.info('Review already exists for this node execution', {
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
            return this.workflowExecutionsService.nextOrEndExecution(c, {
              nodeId: nodeData.id,
              event: WORKFLOW_EVENTS.reviews.approved,
              executionId,
              localResult: existingReview as unknown as Record<string, unknown>,
              globalResult: r,
              workflowId,
              domain,
              token
            });
          } else if (existingReview.status === 'rejected') {
            return this.workflowExecutionsService.nextOrEndExecution(c, {
              nodeId: nodeData.id,
              event: WORKFLOW_EVENTS.reviews.rejected,
              executionId,
              localResult: existingReview as unknown as Record<string, unknown>,
              globalResult: r,
              workflowId,
              domain,
              token
            });
          } else if (existingReview.status === 'additional_data_requested') {
            return this.workflowExecutionsService.nextOrEndExecution(c, {
              nodeId: nodeData.id,
              event: WORKFLOW_EVENTS.reviews.additionalDataRequested,
              executionId,
              localResult: existingReview as unknown as Record<string, unknown>,
              globalResult: r,
              workflowId,
              domain,
              token
            });
          }

          // If the review is still pending or in progress, return the assigned event
          return this.workflowExecutionsService.nextOrEndExecution(c, {
            nodeId: nodeData.id,
            event: WORKFLOW_EVENTS.reviews.assigned,
            executionId,
            localResult: existingReview as unknown as Record<string, unknown>,
            globalResult: r,
            workflowId,
            domain,
            token
          });
        }
        // Create a new review
        const review = await c.run('create-review', async () => {
          const title = String(variables.title || '');
          const description = variables.description ? String(variables.description) : undefined;
          const timeoutInHours = variables.timeoutInHours ? Number(variables.timeoutInHours) : undefined;

          return this.reviewsService.create({
            // nodeExecutionId: executionId,
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
          await this.logsService.info('Review created successfully', {
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
          return this.workflowExecutionsService.createResumable(c, {
            nodeId: nodeData.id,
            event: WORKFLOW_EVENTS.reviews.assigned,
            executionId,
            localResult: review as unknown as Record<string, unknown>,
            globalResult: r,
            workflowId,
            domain,
            token,
            nextNodes: [nodeData]
          });
        });


        // Return the assigned event
        return this.workflowExecutionsService.nextOrEndExecution(c, {
          nodeId: nodeData.id,
          event: WORKFLOW_EVENTS.reviews.assigned,
          executionId,
          localResult: { review: review as unknown as Record<string, unknown>, resumableId: resumable },
          globalResult: r,
          workflowId,
          domain,
          token
        });
      },


      createReview: async (c: ObjectContext, data: CreateReviewRequest) => {
        if (!this.user) throw new Error('User not authenticated');

        const review = await this.reviewsService.create({
          ...data,
          assignToUser: this.user.userId, // Auto-assign to creator
        });

        return { ...review };
      },

      // Get all reviews with optional filtering
      getReviews: async (c: ObjectContext, filter?: GetReviewsRequest) => {
        const reviews = await this.reviewsService.list({
          status: filter?.status as any,
          assignedTo: filter?.assignedTo,
          fromDate: filter?.fromDate ? new Date(filter.fromDate) : undefined,
          toDate: filter?.toDate ? new Date(filter.toDate) : undefined,
        });
        return reviews.map(review => ({ ...review }));
      },

      // Get reviews assigned to a specific user
      getAssignedReviews: async (c: ObjectContext, userId: string) => {
        const reviews = await this.reviewsService.listByAssignee(userId);

        return reviews.map(review => ({ ...review }));
      },

      // Get a single review by ID
      getReview: async (c: ObjectContext, id: string) => {
        const review = await this.reviewsService.getById(id);
        return review ? { ...review } : null;
      },

      // Assign a review to a user
      assignReview: async (c: ObjectContext, id: string) => {
        if (!this.user) throw new Error('User not authenticated');
        const review = await this.reviewsService.assignReview(id, this.user.userId);

        return { ...review };
      },

      // Update a review's status and details
      updateReview: async (c: ObjectContext, { id, data, userId }: UpdateReviewsRequest) => {
        const review = await this.reviewsService.update(id, data, userId);

        return { ...review };
      },

      // Approve a review
      approveReview: async (c: ObjectContext, { id, data }: ApproveReviewRequest) => {
        if (!this.user) throw new Error('User not authenticated');
        const review = await this.reviewsService.update(id, {
          status: 'approved',
          comments: data.comments,
          reviewItems: data.reviewItems,
        }, this.user.userId);

        return { ...review };
      },

      // Reject a review
      rejectReview: async (c: ObjectContext, { id, data }: RejectReviewRequest) => {
        if (!this.user) throw new Error('User not authenticated');
        const review = await this.reviewsService.update(id, {
          status: 'rejected',
          rejectionReason: data.rejectionReason,
          comments: data.comments,
          reviewItems: data.reviewItems,
          evidence: data.evidence,
        }, this.user.userId);

        return { ...review };
      },

      // Request additional data for a review
      requestAdditionalData: async (c: ObjectContext, { id, data }: RequestAdditionalDataRequest) => {
        if (!this.user) throw new Error('User not authenticated');
        const review = await this.reviewsService.update(id, {
          status: 'additional_data_requested',
          additionalDataRequest: data.additionalDataRequest,
          comments: data.comments,
        }, this.user.userId);

        return { ...review };
      },

      // Delete a review
      deleteReview: async (c: ObjectContext, id: string) => {
        const success = await this.reviewsService.delete(id);

        return success;
      },
    },
  });

  constructor(
    @Inject(ReviewsService) private reviewsService: ReviewsService,
    @Inject(LogsService) private logsService: LogsService,
    @Inject(WorkflowExecutionsService) private workflowExecutionsService: WorkflowExecutionsService,
    @Inject(USER) private user: User,
  ) {
    super();
  }
}

