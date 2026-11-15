import { FormInput } from "lucide-react";
import { FormsConfig } from "./FormsConfig";
import { TriggerDefinition } from "../../types";
import { FormConfig } from "@/app/(modules)/(private)/(forms)/(components)/form-builder/schemas";

interface FormTriggerConfig {
  formId?: string;
  formConfig?: FormConfig;
  conditions?: Array<{
    field: string;
    operator: "eq" | "neq" | "contains" | "startsWith" | "endsWith";
    value: string;
  }>;
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
};
