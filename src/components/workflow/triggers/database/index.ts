import { Database } from "lucide-react";
import { TriggerDefinition } from "../types";
import { DatabaseConfig } from "./DatabaseConfig";

export const databaseTrigger: TriggerDefinition = {
  name: "Database",
  description: "Trigger workflow execution on database table changes",
  icon: Database,
  configComponent: DatabaseConfig,
  initialConfig: {
    table: "",
    events: ["record.created"],
    conditions: [],
  },
};
