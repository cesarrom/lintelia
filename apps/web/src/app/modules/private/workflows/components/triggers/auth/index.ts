import { UserCog } from "lucide-react";
import { UsersConfig } from "./UsersConfig";
import { TriggerDefinition } from "../../types";

export const usersTrigger: TriggerDefinition = {
  name: "Users",
  description: "Trigger workflow execution on user events (signup, signin, deletion)",
  icon: UserCog,
  configComponent: UsersConfig,
  initialConfig: { },
};
