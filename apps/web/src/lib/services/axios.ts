import axios from 'axios';
import { useDomain } from '../providers/TenantProvider';
import { useSession } from '@descope/react-sdk';
import { encodeAuthorization } from '@repo/fintivio/utilities';
import { v4 as uuid } from 'uuid';
import { useCallback, useMemo } from 'react';
import * as clients from "@restatedev/restate-sdk-clients";
const VITE_RESTATE_ENDPOINT = import.meta.env.VITE_RESTATE_ENDPOINT;

const rs = clients.connect({ url: VITE_RESTATE_ENDPOINT! });

// Create axios instance with interceptors
export const useAxios = ({ skipBodyModification }: { skipBodyModification: boolean } = { skipBodyModification: false }) => {
  const domain = useDomain();
  const session = useSession();

  const client = useMemo(() => {
    if (!domain || !session.sessionToken) {
      return null;
    }
    const axiosClient = axios.create();

    axiosClient.interceptors.request.use(async (config) => {
      const token = session.sessionToken;
      if (!domain) {
        throw new Error('Tenant is required');
      }
      const key = uuid();

      config.headers.set('idempotency-key', encodeAuthorization({ token: session.sessionToken!, tenant: domain, idempotencyKey: key }));

      if (skipBodyModification) return config;

      // Add domain and token to request payload
      if (config.data) {
        config.data = {
          ...config.data,
          domain,
          token
        };

      } else {
        config.data = { domain, token };
      }

      return config;
    }, (error) => {
      return Promise.reject(error);
    });

    return axiosClient;
  }, [domain, session]);

  // Request interceptor to add domain and token to every request


  return { axios: client, ready: !!client };
}

export const useRestateClient = ({ skipBodyModification }: { skipBodyModification: boolean } = { skipBodyModification: false }) => {
  const domain = useDomain();
  const session = useSession();

  const ready = !!domain && !!session.sessionToken;

  const cb = useCallback(async ({ body = {}, key = uuid(), service, method }: { body?: object, key?: string, method: string, service: string }): Promise<any> => {
    if (!ready) {
      throw new Error('Not ready');
    }
    const idempotency = encodeAuthorization({ token: session.sessionToken!, tenant: domain, idempotencyKey: key });
    const cli = rs
      .objectSendClient({ name: service }, key) as Record<string, any>;

    const payload = body || {};

    if (!skipBodyModification) {
      Object.assign(payload, {
        domain,
        token: session.sessionToken!
      });
    }

    const handle = await cli[method](payload, clients.rpc.sendOpts({ idempotencyKey: idempotency }));

    console.log({
      handle,
      idempotency
    });

    return rs.result(handle);
  }, [skipBodyModification, ready]);

  return {
    ready,
    client: cb,
  }
};