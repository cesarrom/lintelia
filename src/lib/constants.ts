import { from } from 'env-var';
import * as dotenv from 'dotenv';

const noop = () => {};

const config = (dir: string) => {
  dotenv.config({
    path: `${dir}/${process.env.NODE_ENV || ''}.env`,
  });
};
export const ACCESS_SHORT_ID_LENGTH = 8;

const getHookStrings = (hook: string, entityName: string) => ({
  DELETE: `${hook}(${entityName}.delete)`,
  UPDATE: `${hook}(${entityName}.update)`,
  CREATE: `${hook}(${entityName}.create)`,
});

export const EVENTS = {
  PROJECTS: {
    BEFORE: getHookStrings('before', 'projects'),
    AFTER: getHookStrings('after', 'projects'),
  },
};

process.env.MANUAL_CONFIGURATION !== 'true' && config(`${process.env.PWD}`);
const e = from(process.env, {}, noop);

export const env = {
  PORT: e.get('PORT').default('3000').asIntPositive(),
  HOST: e.get('HOST').default('http://localhost:3000').asString(),
  NODE_ENV: e.get('NODE_ENV').default('development').asString(),
  DATABASE_URL: e.get('DATABASE_URL').required().asString(),
  DESCOPE_PROJECT_ID: e.get('DESCOPE_PROJECT_ID').required().asString(),
};
