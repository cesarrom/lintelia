import axios from 'axios';
import { useDomain } from '../providers/TenantProvider';
import { useSession } from '../auth/session';
import { v4 as uuid } from 'uuid';
import { useCallback, useMemo } from 'react';
import * as clients from "@restatedev/restate-sdk-clients";

const VITE_RESTATE_ENDPOINT = import.meta.env.VITE_RESTATE_ENDPOINT;

const rs = clients.connect({ url: VITE_RESTATE_ENDPOINT! });

/** Headers identifying the caller: the session token and the tenant this tab works with. */
const authHeaders = (token: string, domain: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  ...(domain ? { 'X-Tenant': domain } : {}),
});

/**
 * Axios instance for the API. Ready once there is a session (a tenant is optional: platform staff have none).
 * The request body is no longer decorated with the token/domain (they travel as headers), except when the
 * caller explicitly wants them (see useRestateClient for workflow payloads).
 */
export const useAxios = (_options: { skipBodyModification: boolean } = { skipBodyModification: false }) => {
  const domain = useDomain();
  const session = useSession();
  const { refresh } = session;

  const client = useMemo(() => {
    if (!session.sessionToken) {
      return null;
    }
    const axiosClient = axios.create();

    axiosClient.interceptors.request.use((config) => {
      for (const [key, value] of Object.entries(authHeaders(session.sessionToken!, domain))) {
        config.headers.set(key, value);
      }
      return config;
    });

    // An expired/revoked access token: refresh once and retry; a failed refresh ends the session (RequireSession
    // then sends the user to the sign-in page).
    axiosClient.interceptors.response.use(undefined, async (error) => {
      const original = error?.config;
      if (error?.response?.status === 401 && original && !original._retried) {
        const next = await refresh();
        if (next) {
          original._retried = true;
          original.headers.set('Authorization', `Bearer ${next.token}`);
          return axios.request(original);
        }
      }
      return Promise.reject(error);
    });

    return axiosClient;
  }, [domain, session.sessionToken, refresh]);

  return { axios: client!, ready: !!client };
}

/**
 * Calls a Restate virtual object handler through the Restate ingress.
 * Identity travels as invocation headers; `domain` and `token` are also added to the payload because workflow nodes
 * pass them along to the nodes they invoke (Restate does not forward headers between services).
 */
export const useRestateClient = ({ skipBodyModification }: { skipBodyModification: boolean } = { skipBodyModification: false }) => {
  const domain = useDomain();
  const session = useSession();

  const ready = !!session.sessionToken;

  const cb = useCallback(async ({ body = {}, key = uuid(), service, method }: { body?: object, key?: string, method: string, service: string }): Promise<any> => {
    if (!ready) {
      throw new Error('Not ready');
    }
    const cli = rs.objectSendClient({ name: service }, key) as Record<string, any>;

    const payload = body || {};

    if (!skipBodyModification) {
      Object.assign(payload, {
        domain,
        token: session.sessionToken!
      });
    }

    const handle = await cli[method](payload, clients.rpc.sendOpts({
      idempotencyKey: uuid(),
      headers: authHeaders(session.sessionToken!, domain),
    }));

    return rs.result(handle);
  }, [skipBodyModification, ready, domain, session.sessionToken]);

  return {
    ready,
    client: cb,
  }
};
