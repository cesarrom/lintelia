import DescopeClient from '@descope/node-sdk';

const managementKey = "K2ltepz7Bc7eQEhLbKb79WC8csXP4ZNXaPZlCL76gL1M8i9zew8jpM1EM41xsIskSvR0uMr";

// "K2lted1iMZKEh1tLyCb788fdmLwaUzvC2bxqaEo3d65V83cKBdcwl8KN84pRXO25pRN4qs4"; // "K2l4drjaIWy8YuxpgjVSdPduzzF4Go8rvTMUdxCNUeUSvfth8ke6oHj8DILAbBqRozkuifK"

export const auth = DescopeClient({ projectId: 'REDACTED', managementKey: managementKey });