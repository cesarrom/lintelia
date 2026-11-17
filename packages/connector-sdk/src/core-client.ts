import { clientAssertion, type ConnectorKeys } from './keys';

/** Thrown when the core answers with an error. */
export class CoreApiError extends Error {
  constructor(message: string, readonly status: number, readonly body: string) {
    super(message);
  }
}

export interface InstallationInfo {
  id: string;
  displayName: string;
  status: 'pending' | 'active' | 'failing' | 'disabled';
  audience: string;
  scopes: string[];
  configSummary: Record<string, unknown>;
  connectorVersion: string;
}

export interface HandOffContext {
  purpose: 'connect' | 'setup';
  returnUrl: string;
  user: { id: string; email: string; name?: string | null };
  tenant: { name: string; domain: string; pallette?: { primary?: string; secondary?: string; accent?: string } | null };
}

export interface CaseRecordInput {
  type: 'verification' | 'signature_request' | 'message' | 'screening_result' | 'document';
  externalRef: string;
  status: string;
  summary?: string;
  data?: Record<string, unknown>;
  /** Attach to the case of this step (callback token) or to a case by id. */
  callbackToken?: string;
  caseId?: string;
}

/**
 * The connector API of the core, as one installation (docs/plans/03): tokens come from the token endpoint with
 * `private_key_jwt` (client_credentials + installation id, the GitHub Apps model) and are cached until they expire.
 */
export class CoreClient {
  private static tokens = new Map<string, { token: string; expiresAt: number }>();

  constructor(
    private readonly coreUrl: string,
    private readonly connectorId: string,
    private readonly keys: ConnectorKeys,
    readonly installationId: string,
  ) { }

  static async tokenRequest(coreUrl: string, connectorId: string, keys: ConnectorKeys, params: Record<string, string>) {
    const body = new URLSearchParams({
      ...params,
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: await clientAssertion(keys, connectorId),
    });
    const response = await fetch(`${coreUrl}/connector-api/oauth/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(10_000),
    });
    const text = await response.text();
    if (!response.ok) throw new CoreApiError(`Token request failed (${response.status}): ${text.slice(0, 200)}`, response.status, text);
    return JSON.parse(text);
  }

  /** Redeem the single-use code of a connect/setup hand-off. */
  static async redeemCode(coreUrl: string, connectorId: string, keys: ConnectorKeys, code: string) {
    const result = await CoreClient.tokenRequest(coreUrl, connectorId, keys, { grant_type: 'authorization_code', code });
    CoreClient.tokens.set(result.installation.id, { token: result.access_token, expiresAt: Date.now() + (result.expires_in - 60) * 1000 });
    return result as { access_token: string; installation: InstallationInfo; context: HandOffContext };
  }

  private async token() {
    const cached = CoreClient.tokens.get(this.installationId);
    if (cached && cached.expiresAt > Date.now()) return cached.token;
    const result = await CoreClient.tokenRequest(this.coreUrl, this.connectorId, this.keys, { grant_type: 'client_credentials', installation_id: this.installationId });
    CoreClient.tokens.set(this.installationId, { token: result.access_token, expiresAt: Date.now() + (result.expires_in - 60) * 1000 });
    return result.access_token as string;
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const send = async () => fetch(`${this.coreUrl}/connector-api${path}`, {
      method,
      headers: { Authorization: `Bearer ${await this.token()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    let response = await send();
    if (response.status === 401) {
      CoreClient.tokens.delete(this.installationId);
      response = await send();
    }
    const text = await response.text();
    if (!response.ok) throw new CoreApiError(`${method} ${path} failed (${response.status}): ${text.slice(0, 300)}`, response.status, text);
    return (text ? JSON.parse(text) : {}) as T;
  }

  readonly installation = {
    get: () => this.call<InstallationInfo>('GET', '/installation'),
    update: (changes: { status?: 'active' | 'failing'; displayName?: string; configSummary?: Record<string, unknown>; lastError?: string | null; secretsChanged?: string[] }) =>
      this.call<InstallationInfo>('PUT', '/installation', changes),
  };

  readonly executions = {
    /** Finish an async step: `outcome` must be one of the component's events. */
    complete: (callbackToken: string, outcome: string, output: Record<string, unknown> = {}) =>
      this.call<{ completed: boolean }>('POST', '/executions/complete', { callbackToken, outcome, output }),
  };

  readonly records = {
    upsert: (record: CaseRecordInput) => this.call<{ id: string; caseId: string | null; status: string }>('POST', '/records', record),
  };

  readonly files = {
    /** A document for the case (e.g. the signed agreement); the core scans it before it appears on the case. */
    upload: (file: { callbackToken?: string; caseId?: string; name: string; contentType: string; content: Uint8Array; kind?: string }) =>
      this.call<{ uploadId: string; status: string }>('POST', '/files', {
        callbackToken: file.callbackToken, caseId: file.caseId, name: file.name, contentType: file.contentType, kind: file.kind,
        contentBase64: Buffer.from(file.content).toString('base64'),
      }),
  };

  readonly documents = {
    /** A document of the step's case (needs the `files:read` scope), e.g. to extract data from it. */
    read: async (fileId: string, callbackToken: string) => {
      const file = await this.call<{ id: string; name: string; contentType: string; size: number; contentBase64: string }>('GET', `/files/${encodeURIComponent(fileId)}?callbackToken=${encodeURIComponent(callbackToken)}`);
      return { ...file, content: Buffer.from(file.contentBase64, 'base64') };
    },
  };

  readonly clientRecords = {
    /** Records of a client shown in the client app (needs `client-records:write`). */
    write: (input: { client: { id?: string; externalId?: string; source?: string; email?: string }; collection: string; records: Array<{ key: string; data: Record<string, unknown> }>; mode?: 'upsert' | 'merge'; replace?: boolean }) =>
      this.call<{ clientId: string; collection: string; written: number }>('PUT', '/client-records', input),
  };

  readonly events = {
    publish: (event: { id: string; type: string; subject?: string; data?: Record<string, unknown>; applicantEmail?: string }) =>
      this.call<{ duplicate: boolean; started: Array<{ id: string; reference: string }> }>('POST', '/events', event),
  };
}
