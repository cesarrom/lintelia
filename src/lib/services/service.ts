import "reflect-metadata";
import { container, DependencyContainer } from "tsyringe";

export type Newable<T> = { new(...args: any[]): T }

export type InjectionToken<T> = {
  token: symbol | string | Newable<T>;
  optional?: boolean;
} | Newable<T>;

export type AnyInjectionToken<T> = InjectionToken<T> | OptionalToken<T>;

export type Dependency<T> = AnyInjectionToken<T>;

export type InferDependency<T> = T extends new (...args: unknown[]) => infer R
  ? R
  : T extends InjectionToken<infer F>
  ? F extends undefined ? never : F
  : never;

export type InferDependencies<T extends readonly Dependency<unknown>[]> = {
  [K in keyof T]: T[K] extends { optional: true }
  ? InferDependency<T[K]> | undefined
  : InferDependency<T[K]>
};

export type OptionalToken<T> = { token: symbol | string | Newable<T>, optional: true };

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

type GetInjector<Args = never> = (args: Args) => DependencyContainer;

export abstract class Service {
  static dependencies(): Dependency<unknown>[] {
    return [];
  }

  static inject<Deps extends readonly Dependency<Service>[]>(deps: [...Deps], getInjector: GetInjector<void> = () => container.createChildContainer()): InferDependencies<Deps> {
    const injector = getInjector();
    const actualDeps = deps as Dependency<Service>[];
    const visited = new Set<Newable<Service>>();

    const collectDependencies = (deps: Dependency<Service>[] = []): void => {
      deps.forEach(dep => {
        if ('optional' in dep) {
          collectDependencies([dep]);
        } else if (typeof dep === 'object') {
          // TODO: handle token
        } else {
          const service = dep as Newable<Service>
          const castedService = dep as unknown as typeof Service
          if (!visited.has(service)) {
            visited.add(service);
            if (!injector.isRegistered(service)) {
              injector.register(service, service);
              collectDependencies(castedService.dependencies() as Dependency<Service>[]);
            }
          }
        }
      });
    };

    collectDependencies(actualDeps);

    return actualDeps.map(dep => {
      const token = 'optional' in dep ? dep.token : dep;
      const optional = ('optional' in dep) ? !!dep.optional : false;

      try {
        return injector.resolve(token as unknown as string);
      } catch (err) {
        if (optional) return undefined;
        throw err;
      }
    }) as InferDependencies<Deps>;
  }

  static handler<
    Deps extends readonly Dependency<unknown>[],
    Args extends unknown[],
    R
  >(deps: [...Deps], fn: (ctx: { injector: DependencyContainer }, deps: InferDependencies<Deps>, ...args: Args) => R | Promise<R>, getInjector: GetInjector<Args> = () => container.createChildContainer()) {
    return async (...args: Args) => {
      const injector = getInjector(args);
      const resolvedDeps = this.inject(deps as unknown as Dependency<Service>[], () => {
        return injector;
      });

      return Promise.resolve(fn({ injector }, resolvedDeps as any, ...(args as any))).then(result => {
        try {
          return JSON.parse(JSON.stringify(result));
        } catch {
          return result;
        }
      });
    }
  }
}