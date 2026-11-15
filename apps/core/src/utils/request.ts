import { HonoRequest } from "hono";
import { env } from "../constants";

export const proxyRequest = async (req: HonoRequest | Request) => {
  const t = 'raw' in req ? req.raw : req;
  const blob = await readBody(req);
  
  return new Proxy(t, {
    get: (_, prop) => {
      const url = new URL(t.url, env.HOST!);
      const target = new Request(url.toString(), {
        ...t,
        headers: t.headers,
        body: blob,
      });

      if (prop === 'copy') {
        return async () => {
          return target;
        }
      }

      const value = target[prop];

      if (typeof value === 'function') {
        return value.bind(target);
      }

      return value;
    }
  });
}

export const readBody = async (req: HonoRequest | Request) => {
  const raw = 'raw' in req ? req.raw : req;

  const reader = raw.body?.tee?.()?.[0].getReader();

  const chunks: Uint8Array[] = [];

  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  return new Blob(chunks);
}

export const teeRequest = async (req: HonoRequest | Request): Promise<[Request, Request]> => {
  const raw = 'raw' in req ? req.raw : req;

  const blob = await readBody(raw);

  const url = new URL(req.url, env.HOST!);


  const req1 = new Request(url.toString(), {
    ...raw,
    headers: raw.headers,
    body: blob
  });

  const req2 = new Request(url.toString(), {
    ...raw,
    headers: raw.headers,
    body: blob
  });

  return [req1, req2];
}