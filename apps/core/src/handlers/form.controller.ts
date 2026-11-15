import { FormsService } from "../services/forms.service";
import { env } from "../constants";
import { type User, type UpdateFormRequest, type SubmitFormAnswersRequest, type GenerateFormAIRequest, type CreateFormRequest, type CreateTestFormInstanceRequest, type Tenant } from "@repo/fintivio/schemas";
import OpenAI from 'openai';
import { LogsService } from "../services/logs.service";
import { prompts } from "../prompts/prompt";
import { USER } from "../injector/tokens/user.token";
import { Inject, Scope, Controller, Post, Put, Get, Req, Res, type RawBodyRequest, Param } from "@nestjs/common";
import type { HonoRequest } from "hono/request";
import type { Context } from "hono";
import assert from 'assert';
import { TENANT } from "../injector/tokens/tenant.token";
import { type AppRequest, REQUEST_PROXY } from "../injector/tokens/request-proxy.token";

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

@Controller({
  path: '/forms',
  scope: Scope.REQUEST
})
export class FormHandler {
  constructor(
    @Inject(FormsService) private formsService: FormsService,
    @Inject(LogsService) private logsService: LogsService,
    @Inject(USER) private user: User,
    @Inject(TENANT) private tenant: Tenant,
    @Inject(REQUEST_PROXY) private requestProxy: AppRequest,
  ) { }

  @Post('/ai-generate')
  async generateFormWithAI(@Res() ctx: Context): Promise<void> {
    const { prompt, existingConfig }: GenerateFormAIRequest = await this.requestProxy.json();

    const messages = [
      { role: 'system', content: prompts.FORM_GENERATION_PROMPT },
      { role: 'user', content: prompt }
    ];

    if (existingConfig) {
      messages.push({
        role: 'assistant',
        content: `Current form configuration: ${JSON.stringify(existingConfig, null, 2)}`
      });
    }

    try {
      const chatCompletion = await openai.chat.completions.create({
        messages: messages as any,
        model: 'gpt-4-turbo-preview',
        temperature: 0.7,
        response_format: { type: "json_object" }
      });

      const reply = chatCompletion.choices[0].message.content;
      ctx.res = new Response(JSON.stringify({ result: JSON.parse(reply || '{}') }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (error: any) {
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to generate form configuration' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

  @Post()
  async createForm(@Res() ctx: Context): Promise<void> {
    const data: CreateFormRequest = await this.requestProxy.json();
    const result = await this.formsService.create({
      ...data,
      createdBy: this.user!.userId,
    });
    ctx.res = new Response(JSON.stringify({ ...result }), {
      headers: { 'Content-Type': 'application/json' },
      status: 201
    });
    return;
  }

  @Put()
  async updateForm(@Res() ctx: Context): Promise<void> {
    const { data, id }: UpdateFormRequest = await this.requestProxy.json();
    const result = await this.formsService.update(id, data);
    ctx.res = new Response(JSON.stringify({ ...result }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
    return;
  }

  @Get()
  async listForms(@Res() ctx: Context): Promise<void> {
    const url = new URL(this.requestProxy.url);
    const search = url.searchParams.get('search') || undefined;
    const results = await this.formsService.list(search);
    ctx.res = new Response(JSON.stringify(results.map(form => ({ ...form }))), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
    return;
  }

  @Get('/:formId')
  async getFormById(@Res() ctx: Context, @Param('formId') formId: string): Promise<void> {
    assert(formId, 'formId parameter is required');
    const result = await this.formsService.getById(formId);
    ctx.res = new Response(JSON.stringify(result ? { ...result } : null), {
      headers: { 'Content-Type': 'application/json' },
      status: result ? 200 : 404
    });
    return;
  }

  @Get('/:formId/instances')
  async getFormInstances(@Res() ctx: Context, @Param('formId') formId: string): Promise<void> {
    assert(formId, 'formId parameter is required');
    const instances = await this.formsService.listInstances(formId);
    ctx.res = new Response(JSON.stringify(instances.map(instance => ({ ...instance }))), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
    return;
  }

  @Get('/instances/:instanceId')
  async getFormInstance(@Res() ctx: Context, @Param('instanceId') instanceId: string): Promise<void> {
    assert(instanceId, 'instanceId parameter is required');
    try {
      const instance = await this.formsService.getInstance(instanceId);
      if (!instance) {
        ctx.res = new Response(JSON.stringify({ error: 'Form instance not found' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 404
        });
      } else {
        ctx.res = new Response(JSON.stringify({ ...instance }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200
        });
      }
    } catch (error: any) {
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to get form instance' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

  @Post('/:formId/instances')
  async createTestFormInstance(@Res() ctx: Context, @Param('formId') formId: string): Promise<void> {
    assert(formId, 'formId parameter is required');
    const { variables = {} }: Partial<CreateTestFormInstanceRequest> = await this.requestProxy.json();

    try {
      const instance = await this.formsService.createInstance({
        formId,
        variables,
        submittedBy: this.user.userId!,
      });
      ctx.res = new Response(JSON.stringify(instance), {
        headers: { 'Content-Type': 'application/json' },
        status: 201
      });
    } catch (error: any) {
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to create test form instance' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

  @Post('/instances/:instanceId/answers')
  async submitFormAnswers(@Res() ctx: Context, @Param('instanceId') instanceId: string): Promise<void> {
    assert(instanceId, 'instanceId parameter is required');
    const { answers }: SubmitFormAnswersRequest = await this.requestProxy.json();

    try {
      const instance = await this.formsService.getInstance(instanceId);

      if (!instance) {
        ctx.res = new Response(JSON.stringify({ error: 'Form instance not found' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 404
        });
      } else {
        const formAnswer = await this.formsService.createAnswers({
          formId: instance.formId,
          instanceId,
          answers,
        });

        await this.formsService.updateInstance(instanceId, {
          answers,
          status: 'submitted'
        });

        await this.logsService.create({
          message: 'Form answers submitted',
          category: 'form',
          level: 'info',
          metadata: {
            instanceId,
            answerId: formAnswer.id,
            formId: instance.formId,
            submittedBy: this.user?.userId || 'system'
          }
        });

        ctx.res = new Response(JSON.stringify(formAnswer), {
          headers: { 'Content-Type': 'application/json' },
          status: 200
        });
      }
    } catch (error: any) {
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to submit form answers' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

  @Get('/instances/:instancesId/answers')
  async getAnswers(@Res() ctx: Context, @Param('instancesId') instancesId: string): Promise<void> {
    assert(instancesId, 'instancesId parameter is required');
    const answers = await this.formsService.getAnswers(instancesId);
    ctx.res = new Response(JSON.stringify(answers), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
    return;
  }
}
