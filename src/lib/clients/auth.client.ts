import DescopeClient from '@descope/node-sdk';
import { env } from '../constants';

export const auth = DescopeClient({ projectId: env.DESCOPE_PROJECT_ID, managementKey: env.DESCOPE_MANAGEMENT_KEY });

export type AppAuth = typeof auth;