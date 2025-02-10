import { SQSEvent } from "aws-lambda";
import { EventContext, ExecutionContext } from "@/types/schema";
import { tenantsDB, tenants } from "@/lib/models/tenants.sql";
import { eq } from "drizzle-orm";

const handleExecution = async (domain: string, payload: ExecutionContext) => {
  // Get tenant info from domain
  const [tenant] = await tenantsDB
    .select()
    .from(tenants)
    .where(eq(tenants.domain, domain));

  if (!tenant) {
    throw new Error(`No tenant found for domain: ${domain}`);
  }

  const serverUrl = `https://${tenant.domain}`;
  const { workflowId } = payload;

  // Make API call to tenant's workflow execution endpoint
  const response = await fetch(
    `${serverUrl}/api/workflows/${workflowId}/execute`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to execute workflow: ${response.statusText}`);
  }

  return response.json();
}

const handleEvent = async (domain: string, payload: unknown) => {
  // Get tenant info from domain
  const [tenant] = await tenantsDB
    .select()
    .from(tenants)
    .where(eq(tenants.domain, domain));

  if (!tenant) {
    throw new Error(`No tenant found for domain: ${domain}`);
  }

  const serverUrl = `https://${tenant.domain}`;

  // Make API call to tenant's events endpoint
  const response = await fetch(
    `${serverUrl}/api/events`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to process event: ${response.statusText}`);
  }

  return response.json();
}

export const handler = async (evt: SQSEvent) => {
  const { Records } = evt;

  for (const record of Records) {
    const { body } = record;
    const { domain, type, payload } = JSON.parse(body) as EventContext;

    if (type === 'event') {
      return handleEvent(domain, payload);
    }

    return handleExecution(domain, payload as ExecutionContext);
  }
};
