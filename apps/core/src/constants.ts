import { config } from 'dotenv';
import * as envVar from 'env-var';

config();

const e = envVar.from(process.env);

export const env = {
  NODE_ENV: e.get('NODE_ENV').default('local').asString(),
  PORT: e.get('PORT').default('3000').asIntPositive(),
  HOST: e.get('HOST').required().asString(),
  AWS_KEY: e.get('AWS_KEY').required().asString(),
  AWS_SECRET: e.get('AWS_SECRET').required().asString(),
  AWS_REGION: e.get('AWS_REGION').required().asString(),
  DESCOPE_PROJECT_ID: e.get('DESCOPE_PROJECT_ID').required().asString(),
  DESCOPE_MANAGEMENT_KEY: e.get('DESCOPE_MANAGEMENT_KEY').required().asString(),
  AWS_HOSTED_ZONE_ID: e.get('AWS_HOSTED_ZONE_ID').required().asString(),
  BASE_DOMAIN: e.get('BASE_DOMAIN').required().asString(),
  DOMAIN: e.get('DOMAIN').required().asString(),
  KYC_TOKEN: e.get('KYC_TOKEN').required().asString(),
  KYC_SECRET: e.get('KYC_SECRET').required().asString(),
  KYC_WORKFLOW_ID: e.get('KYC_WORKFLOW_ID').required().asString(),
  KYC_ENDPOINT: e.get('KYC_ENDPOINT').required().asString(),
  AWS_CERTIFICATE_ARN: e.get('AWS_CERTIFICATE_ARN').required().asString(),
  BUCKET_ARN: e.get('BUCKET_ARN').required().asString(),
  BUCKET_DOMAIN: e.get('BUCKET_DOMAIN').required().asString(),
  BUCKET_NAME: e.get('BUCKET_NAME').required().asString(),
  SMTP_HOST: e.get('SMTP_HOST').required().asString(),
  SMTP_PORT: e.get('SMTP_PORT').required().asIntPositive(),
  SMTP_SECURE: e.get('SMTP_SECURE').required().asBool(),
  SMTP_USER: e.get('SMTP_USER').required().asString(),
  SMTP_PASS: e.get('SMTP_PASS').required().asString(),
  EMAIL_FROM: e.get('EMAIL_FROM').required().asString(),
  DATABASE_CORE_URL: e.get('DATABASE_CORE_URL').required().asString(),
  DATABASE_CORE_PASSWORD: e.get('DATABASE_CORE_PASSWORD').required().asString(),
  DATABASE_API_KEY: e.get('DATABASE_API_KEY').required().asString(),
  DATABASE_PROJECT_ID: e.get('DATABASE_PROJECT_ID').required().asString(),
  OPENAI_API_KEY: e.get('OPENAI_API_KEY').required().asString(),
  RESTATE_ENDPOINT: e.get('RESTATE_ENDPOINT').required().asString(),
  COMPLYCUBE_API_KEY: e.get('COMPLYCUBE_API_KEY').required().asString(),
  RESTATE_ADMIN_ENDPOINT: e.get('RESTATE_ADMIN_ENDPOINT').required().asString(),
  DOCUSEAL_TOKEN: e.get('DOCUSEAL_TOKEN').required().asString(),
  DOCUSEAL_EMAIL: e.get('DOCUSEAL_EMAIL').required().asString(),

};

export type AppEnvironment = typeof env;
