import { Globe } from "lucide-react";
import { ApiConfig } from "./ApiConfig";
import { TriggerDefinition } from "../../types";

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

export const apiTrigger: TriggerDefinition<ApiTriggerConfig> = {
  name: "API",
  description: "Trigger workflow execution via HTTP POST request",
  icon: Globe,
  configComponent: ApiConfig,
  initialConfig: {
    requiredParams: [],
    requiredHeaders: [],
  },
};
