import { Access, Require } from "../auth/access";
import type { User, GetReviewsRequest, UpdateReviewsRequest, ApproveReviewRequest, RejectReviewRequest, RequestAdditionalDataRequest, CreateReviewRequest, ReviewStatus } from "@repo/lintelia/schemas";
import { ReviewsService } from "../services/reviews.service";
import { USER } from "../injector/tokens/user.token";
import { Inject, Scope, Controller, Post, Get, Patch, Put, Res, Param } from "@nestjs/common";
import type { Context } from "hono";
import assert from 'assert';
import { type AppRequest, REQUEST_PROXY } from "../injector/tokens/request-proxy.token";

@Controller({
  path: '/reviews',
  scope: Scope.REQUEST
})
export class ReviewHandler {
  constructor(
    @Inject(ReviewsService) private reviewsService: ReviewsService,
    @Inject(USER) private user: User,
    @Inject(REQUEST_PROXY) private readonly requestProxy: AppRequest,
  ) { }

  private buildGetReviewsFilter(queryParams: Record<string, string | string[]>): GetReviewsRequest {
    const filter: GetReviewsRequest = {};
    if (queryParams.status) filter.status = queryParams.status as ReviewStatus;
    if (queryParams.assignedTo) filter.assignedTo = queryParams.assignedTo as string;
    if (queryParams.fromDate) filter.fromDate = (queryParams.fromDate as string);
    if (queryParams.toDate) filter.toDate = (queryParams.toDate as string);
    return filter;
  }

  @Require('tasks:work')
  @Post()
  async createReview(@Res() ctx: Context): Promise<void> {
    assert(this.user, 'User not authenticated');
    try {
      const data: CreateReviewRequest = await this.requestProxy.json();
      const review = await this.reviewsService.create({
        ...data,
        assignToUser: this.user.userId, 
      });
      ctx.res = new Response(JSON.stringify({ ...review }), {
        headers: { 'Content-Type': 'application/json' },
        status: 201
      });
    } catch (error: any) {
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to create review' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

  @Require('cases:read')
  @Get()
  async getReviews(@Res() ctx: Context): Promise<void> {
    try {
      const url = new URL(this.requestProxy.url);
      const filter = this.buildGetReviewsFilter(Object.fromEntries(url.searchParams.entries()));
      const reviews = await this.reviewsService.list(filter);
      ctx.res = new Response(JSON.stringify(reviews.map(review => ({ ...review }))), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (error: any) {
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to get reviews' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

  @Require('cases:read')
  @Get('/assignees/:assigneeId')
  async getAssignedReviews(@Res() ctx: Context, @Param('assigneeId') assigneeId: string): Promise<void> {
    assert(assigneeId, 'assigneeId parameter is required');
    try {
      const reviews = await this.reviewsService.listByAssignee(assigneeId);
      ctx.res = new Response(JSON.stringify(reviews.map(review => ({ ...review }))), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (error: any) {
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to get assigned reviews' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

  @Require('cases:read')
  @Get('/:reviewId')
  async getReview(@Res() ctx: Context, @Param('reviewId') reviewId: string): Promise<void> {
    assert(reviewId, 'reviewId parameter is required');
    try {
      const review = await this.reviewsService.getById(reviewId);
      if (!review) {
        ctx.res = new Response(JSON.stringify({ error: 'Review not found' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 404
        });
      } else {
        ctx.res = new Response(JSON.stringify({ ...review }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200
        });
      }
    } catch (error: any) {
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to get review' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

  @Require('tasks:assign')
  @Patch('/:reviewId/assignees/:assigneeId') 
  async assignReview(@Res() ctx: Context, @Param('reviewId') reviewId: string): Promise<void> {
    assert(reviewId, 'reviewId parameter is required');
    assert(this.user, 'User not authenticated');
    try {
      const review = await this.reviewsService.assignReview(reviewId, this.user.userId);
      ctx.res = new Response(JSON.stringify({ ...review }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (error: any) {
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to assign review' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500 
      });
    }
    return;
  }

  @Require('tasks:work')
  @Put('/:reviewId')
  async updateReview(@Res() ctx: Context, @Param('reviewId') reviewId: string): Promise<void> {
    assert(reviewId, 'reviewId parameter is required');
    assert(this.user, 'User not authenticated'); 
    try {
      const { data }: Pick<UpdateReviewsRequest, 'data'> = await this.requestProxy.json();
      assert(data, 'data is required in the request body');

      const review = await this.reviewsService.update(reviewId, data, this.user.userId);
      ctx.res = new Response(JSON.stringify({ ...review }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (error: any) {
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to update review' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500 
      });
    }
    return;
  }

  @Require('tasks:work')
  @Patch('/:reviewId/approve')
  async approveReview(@Res() ctx: Context, @Param('reviewId') reviewId: string): Promise<void> {
    assert(reviewId, 'reviewId parameter is required');
    assert(this.user, 'User not authenticated');
    try {
      const { data }: Pick<ApproveReviewRequest, 'data'> = await this.requestProxy.json();
      assert(data, 'data is required in the request body');

      const review = await this.reviewsService.update(reviewId, {
        status: 'approved',
        comments: data.comments,
        reviewItems: data.reviewItems,
      }, this.user.userId);
      ctx.res = new Response(JSON.stringify({ ...review }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (error: any) {
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to approve review' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

  @Require('tasks:work')
  @Patch('/:reviewId/reject') 
  async rejectReview(@Res() ctx: Context, @Param('reviewId') reviewId: string): Promise<void> {
    assert(reviewId, 'reviewId parameter is required');
    assert(this.user, 'User not authenticated');
    try {
      const { data }: Pick<RejectReviewRequest, 'data'> = await this.requestProxy.json();
      assert(data, 'data is required in the request body');

      const review = await this.reviewsService.update(reviewId, {
        status: 'rejected',
        rejectionReason: data.rejectionReason,
        comments: data.comments,
        reviewItems: data.reviewItems,
        evidence: data.evidence,
      }, this.user.userId);
      ctx.res = new Response(JSON.stringify({ ...review }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (error: any) {
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to reject review' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

  @Require('tasks:work')
  @Post('/:reviewId/additional-data')
  async requestAdditionalData(@Res() ctx: Context, @Param('reviewId') reviewId: string): Promise<void> {
    assert(reviewId, 'reviewId parameter is required');
    assert(this.user, 'User not authenticated');
    try {
      const { data }: Pick<RequestAdditionalDataRequest, 'data'> = await this.requestProxy.json();
      assert(data, 'data is required in the request body');

      const review = await this.reviewsService.update(reviewId, {
        status: 'additional_data_requested',
        additionalDataRequest: data.additionalDataRequest,
        comments: data.comments,
      }, this.user.userId);
      ctx.res = new Response(JSON.stringify({ ...review }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (error: any) {
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to request additional data' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }
}
