import { Access, Require } from "../auth/access";
import type { CreateSystemVariableInput } from "@repo/lintelia/schemas";
import { Scope, Inject, Controller, Get, Put, Delete, Res, type RawBodyRequest, Param } from "@nestjs/common"; 
import type { Context } from "hono"; 
import { SystemVariablesService } from "../services/system-variables.service";
import assert from 'assert'; 
import { type AppRequest, REQUEST_PROXY } from "../injector/tokens/request-proxy.token";

@Controller({
  path: '/system-variables',
  scope: Scope.REQUEST
})
export class SystemHandler {
  constructor(@Inject(SystemVariablesService) private systemVariablesService: SystemVariablesService, @Inject(REQUEST_PROXY) private readonly requestProxy: AppRequest) { }

  @Require('variables:read')
  @Get()
  async getSystemVariables(@Res() ctx: Context): Promise<void> { 
    try {
      const variables = await this.systemVariablesService.list();
      ctx.res = new Response(JSON.stringify(variables), { 
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (error: any) {
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to get system variables' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  };

  @Require('variables:read')
  @Get('/names')
  async getSystemVariableNames(@Res() ctx: Context): Promise<void> { 
    try {
      const variables = await this.systemVariablesService.list();
      const variableNames = variables.map(v => ({
        name: v.name,
        description: v.description,
        type: v.type
      }));
      ctx.res = new Response(JSON.stringify(variableNames), { 
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (error: any) {
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to get system variable names' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  };

  @Require('variables:read')
  @Get('/:key')
  async getSystemVariable(@Param('key') key: string, @Res() ctx: Context): Promise<void> { 
    assert(key, 'key parameter is required');
    try {
      const variable = await this.systemVariablesService.getById(key);
      if (!variable) {
        ctx.res = new Response(JSON.stringify({ error: 'System variable not found' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 404
        });
      } else {
        ctx.res = new Response(JSON.stringify(variable), { 
          headers: { 'Content-Type': 'application/json' },
          status: 200
        });
      }
    } catch (error: any) {
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to get system variable' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  };

  @Require('variables:manage')
  @Put('/:key')
  async createSystemVariable(@Param('key') key: string, @Res() ctx: Context): Promise<void> { 
    assert(key, 'key parameter is required');
    try {
      const { value, description, type }: Omit<CreateSystemVariableInput, 'name'> = await this.requestProxy.json();
      assert(value !== undefined, 'value is required in the request body'); 

      const data: CreateSystemVariableInput = { name: key, value, description, type };

      const variable = await this.systemVariablesService.create(data);

      ctx.res = new Response(JSON.stringify(variable), { 
        headers: { 'Content-Type': 'application/json' },
        status: 200 
      });
    } catch (error: any) {
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to create/update system variable' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

  @Require('variables:manage')
  @Delete('/:key')
  async deleteSystemVariable(@Param('key') key: string, @Res() ctx: Context): Promise<void> { 
    assert(key, 'key parameter is required');
    try {
      const success = await this.systemVariablesService.delete(key);
      if (!success) {
        ctx.res = new Response(JSON.stringify({ error: 'System variable not found' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 404
        });
      } else {
        ctx.res = new Response(null, { status: 204 });
      }
    } catch (error: any) {
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to delete system variable' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }
}
