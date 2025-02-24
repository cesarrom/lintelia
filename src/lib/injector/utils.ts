import assert from "assert";
import { getContextualInjector } from "./action";
import { getInjector } from "./injector";
import { auth } from "../clients/auth.client";
import { TENANT_TOKEN } from "./tokens";
import { Tenant } from "../entities/global";
type Newable<T> = { new(...args: any[]): T };

type InjectionToken<T> = {
  token: symbol | string | Newable<T>;
  optional?: boolean;
} | Newable<T>;

type AnyInjectionToken<T> = InjectionToken<T> | OptionalToken<T>;

type Dependency<T> = AnyInjectionToken<T>;

type InferDependency<T> = T extends new (...args: unknown[]) => infer R
  ? R
  : T extends InjectionToken<infer F>
  ? F extends undefined ? never : F
  : never;

type InferDependencies<T extends readonly Dependency<unknown>[]> = {
  [K in keyof T]: T[K] extends { optional: true }
  ? InferDependency<T[K]> | undefined
  : InferDependency<T[K]>
};

type OptionalToken<T> = { token: symbol | string | Newable<T>, optional: true };

export function token<T>(_token: symbol | string): InjectionToken<T> {
  return { token: _token, optional: false };
}

export function optional<T>(dep: InjectionToken<T>): OptionalToken<T> {
  if ('optional' in dep) {
    dep.optional = true;
    return dep as OptionalToken<T>;
  }

  return {
    token: dep as Newable<T>,
    optional: true
  };
}


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
  options: { isWorkflow?: boolean } = {}
): (...args: Args | [...Args, undefined | { domain?: string, token?: string }]) => Promise<R> {
  return async (...args: Args | [...Args, undefined | { domain?: string, token?: string }]) => {
    const options = args[args.length - 1];
    let ctx: Awaited<ReturnType<typeof getContextualInjector>>;

    if (isOptions(options)) {
      const info = await auth.validateJwt(options.token || '');

      assert(info?.token?.sub, 'Valid token is required');

      const { data: user } = await auth.management.user.loadByUserId(info?.token?.sub || '');

      assert(user, 'User not found');
      const injector = await getInjector(options.domain);

      ctx = {
        injector,
        user,
        tenant: injector.resolve(TENANT_TOKEN) as Tenant
      }
    } else {
      ctx = await getContextualInjector();
    }
    const resolvedDeps = deps.map(dep => {
      const token = 'optional' in dep ? dep.token : dep;
      const optional = ('optional' in dep) ? !!dep.optional : false;

      try {
        return ctx.injector.resolve(token as unknown as string);
      } catch (err) {
        if (optional) return undefined;
        throw err;
      }
    }) as InferDependencies<Deps>;
    return Promise.resolve(fn(ctx, resolvedDeps, ...(args as any)));
  };
}

