import { expect } from '@playwright/test';
import { env } from './env';

export interface PublicTenant {
  id: string;
  domain: string;
  name: string;
}

export interface Session {
  token: string;
  expiresAt: number;
  user: { userId: string; kind: 'staff' | 'member' | 'client'; email: string; name?: string; userTenants: Array<{ tenantId: string; roleNames: string[] }> };
  tenant: PublicTenant | null;
}

/** What `POST /auth/login` can answer: a session, or a second-factor challenge / enrolment requirement. */
export type SignInResponse = Partial<Session> & {
  mfaRequired?: boolean;
  mfaToken?: string;
  mfaEnrollmentRequired?: boolean;
  enrollmentToken?: string;
  error?: string;
};

export interface ApiResponse<T = any> {
  status: number;
  body: T;
  headers: Headers;
}

type Body = Record<string, unknown> | unknown[] | URLSearchParams | FormData | undefined;

/**
 * Thin HTTP client for the API. Identity travels like in the web app: `Authorization: Bearer` + `X-Tenant`.
 * It never throws on HTTP errors: tests assert on `status`.
 */
export class Api {
  constructor(private readonly opts: { token?: string; tenant?: string | null; headers?: Record<string, string> } = {}) { }

  static anonymous(tenant?: string | null) {
    return new Api({ tenant });
  }

  static as(session: Session, tenant: string | null = session.tenant?.domain ?? null) {
    return new Api({ token: session.token, tenant });
  }

  static withToken(token: string, tenant?: string | null) {
    return new Api({ token, tenant });
  }

  forTenant(tenant: string | null) {
    return new Api({ ...this.opts, tenant });
  }

  withHeaders(headers: Record<string, string>) {
    return new Api({ ...this.opts, headers: { ...this.opts.headers, ...headers } });
  }

  async request<T = any>(method: string, path: string, body?: Body): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = { ...this.opts.headers };
    if (this.opts.token) headers.Authorization = `Bearer ${this.opts.token}`;
    if (this.opts.tenant) headers['X-Tenant'] = this.opts.tenant;
    let payload: BodyInit | undefined;
    if (body instanceof URLSearchParams || body instanceof FormData) {
      payload = body;
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const response = await fetch(new URL(path, env.apiUrl), { method, headers, body: payload, redirect: 'manual' });
    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      // keep text
    }
    return { status: response.status, body: parsed as T, headers: response.headers };
  }

  get<T = any>(path: string) { return this.request<T>('GET', path); }
  post<T = any>(path: string, body?: Body) { return this.request<T>('POST', path, body ?? {}); }
  put<T = any>(path: string, body?: Body) { return this.request<T>('PUT', path, body ?? {}); }
  patch<T = any>(path: string, body?: Body) { return this.request<T>('PATCH', path, body ?? {}); }
  delete<T = any>(path: string, body?: Body) { return this.request<T>('DELETE', path, body); }
}

const describe = (res: ApiResponse) => `HTTP ${res.status}: ${typeof res.body === 'string' ? res.body : JSON.stringify(res.body)}`.slice(0, 600);

/** Assert an exact status, showing the response body when it differs. */
export const expectStatus = (res: ApiResponse, status: number | number[]) => {
  if (Array.isArray(status)) {
    expect(status, `expected one of ${status.join('/')}, got ${describe(res)}`).toContain(res.status);
  } else {
    expect(res.status, describe(res)).toBe(status);
  }
};

/** The caller was let through (not 401/403). The operation itself may still fail validation. */
export const expectAllowed = (res: ApiResponse) => {
  // Allowed = the request reached the operation: success, or a validation/conflict answer about the input.
  // 401/403 (refused), 404 (endpoint or resource missing) and 5xx do not count.
  const reached = (res.status >= 200 && res.status < 300) || [400, 409, 422].includes(res.status);
  expect(reached, `expected to be allowed, got ${describe(res)}`).toBe(true);
};

/** The caller was stopped by authorization (403). */
export const expectForbidden = (res: ApiResponse) => expectStatus(res, 403);

/** Decode a JWT payload without verifying it (for asserting on claims/lifetimes). */
export const decodeJwt = (token: string) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
