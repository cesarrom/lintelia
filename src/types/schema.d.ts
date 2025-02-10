export type EventContext<T = unknown> = {
  domain: string;
  type: 'execute' | 'event';
  eventName: string;
  payload: T;
  createdAt: number;
}

export type ExecutionContext = {
  domain: string
  executionId: string;
  executionNodeId: string;
  eventName: string;
  triggeredBy: string;
  triggeredByRole: string;
  workflowId: string;
  listenerId?: string;
}