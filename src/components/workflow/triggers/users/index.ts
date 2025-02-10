import { UserCog } from "lucide-react";
import { TriggerDefinition } from "../types";
import { UsersConfig } from "./UsersConfig";

export const usersTrigger: TriggerDefinition = {
  name: "Users",
  description: "Trigger workflow execution on user events (signup, signin, deletion)",
  icon: UserCog,
  configComponent: UsersConfig,
  initialConfig: {
    events: ["user.signup"],
    userRoles: [],
  },
};
