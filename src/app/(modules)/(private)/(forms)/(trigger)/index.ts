import { FormInput } from "lucide-react";
import { TriggerDefinition } from "../types";
import { FormsConfig } from "./FormsConfig";
import { EventContext } from "@/types/schema";
import { FormConfig } from "@/types/form";

interface FormTriggerConfig {
  formId?: string;
  formConfig?: FormConfig;
  conditions?: Array<{
    field: string;
    operator: "eq" | "neq" | "contains" | "startsWith" | "endsWith";
    value: string;
  }>;
}

interface FormSubmissionPayload {
  formId: string;
  response: Record<string, string | number | boolean>;
}

export const formsTrigger: TriggerDefinition<FormTriggerConfig> = {
  name: "Forms",
  description: "Trigger workflow execution when a form is submitted",
  icon: FormInput,
  configComponent: FormsConfig,
  initialConfig: {
    formId: "",
    conditions: [],
  },

  async shouldExecute(context: EventContext, config: FormTriggerConfig) {
    const payload = context.payload as FormSubmissionPayload;

    // If this is not a form submission event, don't execute
    if (!payload.formId || !payload.response) {
      return false;
    }

    // If a specific form is configured, check if it matches
    if (config.formId && payload.formId !== config.formId) {
      return false;
    }

    // Check conditions if any are configured
    if (config.conditions && config.conditions.length > 0) {
      return config.conditions.every((condition) => {
        const fieldValue = payload.response[condition.field];
        if (fieldValue === undefined) return false;

        switch (condition.operator) {
          case "eq":
            return fieldValue === condition.value;
          case "neq":
            return fieldValue !== condition.value;
          case "contains":
            return String(fieldValue).includes(condition.value);
          case "startsWith":
            return String(fieldValue).startsWith(condition.value);
          case "endsWith":
            return String(fieldValue).endsWith(condition.value);
          default:
            return false;
        }
      });
    }

    return true;
  },

  async getEventData(context: EventContext) {
    const payload = context.payload as FormSubmissionPayload;
    
    // Get form details if we have a formId
    let form = null;
    if (payload.formId) {
      form = {} /*await prisma.form.findUnique({
        where: { id: payload.formId },
        select: {
          id: true,
          name: true,
          description: true,
          fields: true,
          createdAt: true,
          updatedAt: true,
        },
      });*/
    }

    return {
      form,
      response: payload.response,
      submittedAt: new Date().toISOString(),
    };
  },
};
