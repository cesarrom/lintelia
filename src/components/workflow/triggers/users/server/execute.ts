import { EventContext } from "@/types/schema";
import { WorkflowTrigger } from "../../TriggersSidebar";
import { auth } from "@/lib/clients/auth.client";

interface UserEventPayload {
  userId: string;
  email: string;
  [key: string]: unknown;
}

export async function shouldExecute(event: EventContext<UserEventPayload>, trigger: WorkflowTrigger) {
  // Check if the event type matches any of the configured events
  const events = trigger.config.events as string[];
  if (!events.includes(event.eventName)) {
    return false;
  }

  // If roles are configured, check if the user has any of the roles
  const userRoles = trigger.config.userRoles as string[];
  if (userRoles && userRoles.length > 0) {
    // Extract user ID from event payload
    const { userId } = event.payload;
    if (!userId) return false;

    try {
      // Get user's roles from Auth0
      const {data:user} = await auth.management.user.loadByUserId(userId);
      if (!user) return false;
      const userRoleIds = (user.roleNames || []) as string[];

      // Check if user has any of the required roles
      const hasRequiredRole = userRoleIds.some(roleId => userRoles.includes(roleId));
      if (!hasRequiredRole) {
        return false;
      }
    } catch (error) {
      console.error("Error checking user roles:", error);
      return false;
    }
  }

  return true;
}

export async function execute(event: EventContext<UserEventPayload>) {
  // The execution context will be created by the workflow execution service
  // This trigger doesn't need any special execution logic
  return {
    success: true,
    outputs: event.payload,
  };
} 