import { Globe } from "lucide-react";
import { TriggerDefinition } from "../types";
import { ApiConfig } from "./ApiConfig";
import { EventContext } from "@/types/schema";
import { verifyApiKey } from "@/lib/auth/api-keys";

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

interface ApiRequestPayload {
  headers: Record<string, string>;
  params: Record<string, unknown>;
  body: Record<string, unknown>;
}

export const apiTrigger: TriggerDefinition<ApiTriggerConfig> = {
  name: "API",
  description: "Trigger workflow execution via HTTP POST request",
  icon: Globe,
  configComponent: ApiConfig,
  initialConfig: {
    requiredParams: [],
    requiredHeaders: [],
  },

  async shouldExecute(context: EventContext, config: ApiTriggerConfig) {
    const payload = context.payload as ApiRequestPayload;

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
  },

  async getEventData(context: EventContext) {
    const payload = context.payload as ApiRequestPayload;
    
    return {
      headers: payload.headers,
      params: payload.params,
      body: payload.body,
      timestamp: new Date().toISOString(),
    };
  },
};
