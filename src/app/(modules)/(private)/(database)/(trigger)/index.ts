import { Database } from "lucide-react";
import { DatabaseConfig } from "./DatabaseConfig";
import { TriggerDefinition } from "../../(workflows)/(components)/triggers/types";

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
