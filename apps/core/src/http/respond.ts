import type { Context } from 'hono';

/** Set a JSON response on the Hono context (controllers use `@Res() ctx: Context`). */
export const json = (ctx: Context, body: unknown, status = 200) => {
  ctx.res = new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
};

/** Map an error to a JSON response, honouring a numeric `status` on the error (AuthError, access errors...). */
export const jsonError = (ctx: Context, error: unknown, fallbackMessage: string, fallbackStatus = 500) => {
  const status = typeof (error as any)?.status === 'number' ? (error as any).status : fallbackStatus;
  const message = error instanceof Error && error.message ? error.message : fallbackMessage;
  if (status >= 500) console.error(fallbackMessage, error);
  const errors = (error as any)?.errors;
  json(ctx, Array.isArray(errors) && errors.length ? { error: message, errors } : { error: message }, status);
};

/** Run a controller action and answer with its JSON result, or with the mapped error. */
export const handle = async (ctx: Context, action: () => Promise<unknown> | unknown, fallbackMessage = 'Request failed', status = 200) => {
  try {
    json(ctx, await action(), status);
  } catch (error) {
    jsonError(ctx, error, fallbackMessage);
  }
};

/** Best-effort client address (behind the dev proxy / a load balancer). */
export const clientIp = (headers: Headers) =>
  headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'local';
