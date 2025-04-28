import { Dependency, InferDependencies, optional, Service } from "../services/service";
import assert from "assert";
import { getContextualInjector } from "./action";
import { RESTATE_CONTEXT_TOKEN } from "./tokens";
import * as restate from "@restatedev/restate-sdk/fetch";
import { set } from "lodash";
import { container } from "tsyringe";
import { WebService } from "../services/web.service";
import { UsersService } from "../services/users.service";
import { AuthService } from "../services/auth.service";
import { TenantsService } from "../services/tenants.service";
import { SystemVariablesService } from "../services/system-variables.service";


type Ctx = Awaited<ReturnType<typeof getContextualInjector>>;

const isOptions = (arg: unknown): arg is { domain?: string, token?: string } => {
  return typeof arg === 'object' && arg !== null && 'domain' in arg && 'token' in arg;
}


export function inject<
  Deps extends readonly Dependency<unknown>[],
  Args extends unknown[],
  R
>(
  deps: [...Deps],
  fn: (ctx: Ctx, deps: InferDependencies<Deps>, ...args: Args) => R | Promise<R>,
): (...args: Args | [...Args, undefined | { domain?: string, token?: string }]) => Promise<R> {
  return Service.handler([WebService, UsersService, AuthService, TenantsService, ...deps], async ({ injector }, [web, users, auth, tenants, ...deps], ...args) => {
    const options = args[args.length - 1];

    if (isOptions(options)) {
      const info = await auth.auth.validateJwt(options.token || '');

      assert(info?.token?.sub, 'Valid token is required');

      web.mockUserId(info?.token?.sub || '');
    }

    const ctx = {
      injector,
      tenant: (await tenants.getContextualTenant()),
      user: (await users.getSessionUser()),
    }

    return Promise.resolve(fn(ctx, deps, ...(args as any))).then(result => {
      try {
        return JSON.parse(JSON.stringify(result));
      } catch {
        return result;
      }
    });
  });
}

type WorkflowCtx = Ctx & { systemVariables: Record<string, any> }

export function workflowInject<
  Deps extends readonly Dependency<unknown>[],
  Args extends [restate.ObjectContext, { domain?: string, token?: string, result: Record<string, any> }],
  R
>(
  deps: [...Deps],
  fn: (ctx: WorkflowCtx, deps: InferDependencies<Deps>, ...args: Args) => R | Promise<R>,
): (...args: Args) => Promise<R> {
  return Service.handler([optional(SystemVariablesService), WebService, UsersService, AuthService, TenantsService, ...deps],
    async ({ injector }, [svService, web, users, auth, tenants, ...deps], ...args) => {
      const [c, authInfo] = args;
      const { domain, token, result = {} } = authInfo;

      const info = await c.run('validate-session', async () => {
        const info = await auth.auth.validateJwt(token || '')
        assert(info?.token?.sub, 'Valid token is required');
        return info;
      });

      web.mockUserId(info?.token?.sub || '');
      web.mockDomain(domain || '');


      const user = await c.run('fetch-user', async () => {
        return users.getSessionUser();
      });

      const tenant = await c.run('fetch-tenant', async () => {
        return tenants.getContextualTenant();
      });


      injector.register(RESTATE_CONTEXT_TOKEN, { useValue: c });

      let systemVariables = await c.get('system-variables');

      if (!systemVariables) {
        assert(svService, 'System variables service is required');
        const sv = await c.run('fetch-system-variables', async () => await svService.asRecord());
        systemVariables = sv;
        c.set('system-variables', sv);
      }

      set(result, ['System', 'variables'], systemVariables);

      const ctx = {
        injector,
        user,
        systemVariables,
        tenant,
      } as WorkflowCtx;

      return Promise.resolve(fn(ctx, deps, ...args)).then(result => {
        try {
          return JSON.parse(JSON.stringify(result));
        } catch {
          return result;
        }
      })
    },
    ([...args]) => {
      const injector = container.createChildContainer();
      const [c] = args;
      injector.register(RESTATE_CONTEXT_TOKEN, { useValue: c });
      return injector;
    }
  );
}
