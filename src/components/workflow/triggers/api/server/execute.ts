import { EventContext } from "@/types/schema";
import { verifyApiKey } from "@/lib/auth/api-keys";

interface ApiRequestPayload {
  headers: Record<string, string>;
  params: Record<string, unknown>;
  body: Record<string, unknown>;
}

interface ApiTriggerConfig {
  apiKeyId?: string;
  apiKey?: string;
  requiredParams?: Array<{
    name: string;
    type: "string" | "number" | "boolean";
    required: boolean;
  }>;
  requiredHeaders?: Array<{
    name: string;
    value: string;
  }>;
}

export async function shouldExecute(event: EventContext<ApiRequestPayload>, config: ApiTriggerConfig) {
  const payload = event.payload;

  // Verify API key if configured
  if (config.apiKeyId) {
    const apiKeyHeader = payload.headers["x-api-key"];
    if (!apiKeyHeader) return false;

    try {
      const isValid = await verifyApiKey(config.apiKeyId, apiKeyHeader);
      if (!isValid) return false;
    } catch {
      return false;
    }
  }

  // Verify required headers
  if (config.requiredHeaders && config.requiredHeaders.length > 0) {
    const hasAllHeaders = config.requiredHeaders.every(
      (header) => payload.headers[header.name.toLowerCase()] === header.value
    );
    if (!hasAllHeaders) return false;
  }

  // Verify required parameters
  if (config.requiredParams && config.requiredParams.length > 0) {
    const hasAllParams = config.requiredParams.every((param) => {
      const value = payload.params[param.name];
      if (param.required && value === undefined) return false;
      if (value !== undefined && typeof value !== param.type) return false;
      return true;
    });
    if (!hasAllParams) return false;
  }

  return true;
}

export async function execute(event: EventContext<ApiRequestPayload>) {
  return {
    success: true,
    outputs: {
      headers: event.payload.headers,
      params: event.payload.params,
      body: event.payload.body,
      timestamp: new Date().toISOString(),
    },
  };
} 