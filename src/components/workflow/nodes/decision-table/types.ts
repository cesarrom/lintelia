export type DecisionTableNodeData = {
  description: string;
  rules: DecisionTableRule[];
};

export type DecisionTableRule = {
  condition: string;
  action: string;
};