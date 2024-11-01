import * as envVar from 'env-var';
import { Resource as R } from 'sst';

const noop = () => { };

const Resource = new Proxy(R, {
  get: (target, prop) => {
    try {
      return target[prop];
    } catch (error) {
      return new Proxy({}, {
        get() {
          return '-'
        }
      });
    }
  }

}) as any;

const e = envVar.from(process.env, {}, noop);

export const env = {
  PORT: e.get('PORT').default('3000').asIntPositive(),
  HOST: e.get('HOST').default(Resource.Parameters.host).asString(),
  AWS_KEY: e.get('AWS_KEY').default(Resource.Parameters.awsKey).required().asString(),
  AWS_SECRET: e.get('AWS_SECRET').default(Resource.Parameters.awsSecret).required().asString(),
  AWS_REGION: e.get('AWS_REGION').default(Resource.Parameters.awsRegion).required().asString(),
  DESCOPE_PROJECT_ID: e.get('DESCOPE_PROJECT_ID').default(Resource.Parameters.descopeProjectId).required().asString(),
  AWS_HOSTED_ZONE_ID: e.get('AWS_HOSTED_ZONE_ID').default(Resource.Parameters.awsHostedZoneId).required().asString(),
  BASE_DOMAIN: e.get('BASE_DOMAIN').default(Resource.Parameters.baseDomain).required().asString(),
  DOMAIN: e.get('DOMAIN').default(Resource.Parameters.domain).required().asString(),
  DATABASE_NAME: e.get('DATABASE_NAME').default(Resource.Parameters.databaseName).required().asString(),
  DATABASE_ID: e.get('DATABASE_ID').default(Resource.Parameters.databaseId).required().asString(),
  DATABASE_URL: e.get('DATABASE_URL').default(Resource.Parameters.databaseUrl).required().asString(),
  DATABASE_AUTH_TOKEN: e.get('DATABASE_AUTH_TOKEN').default(Resource.Parameters.databaseAuthToken).required().asString(),
  DATABASE_GROUP_NAME: e.get('DATABASE_GROUP_NAME').default('fintivio-platform').required().asString(),
  KYC_TOKEN: e.get('KYC_TOKEN').default(Resource.Parameters.kycToken).required().asString(),
  KYC_WORKFLOW_ID: e.get('KYC_TOKEN').default(Resource.Parameters.kycWorkflowId).required().asString(),
  AWS_CERTIFICATE_ARN: e.get('AWS_CERTIFICATE_ARN').default(Resource.Parameters.awsCertificateArn).required().asString(),
  BUCKET_ARN: e.get('BUCKET_ARN').default(Resource.Parameters.bucketArn).required().asString(),
  BUCKET_DOMAIN: e.get('BUCKET_DOMAIN').default(Resource.Parameters.bucketDomain).required().asString(),
  BUCKET_NAME: e.get('BUCKET_NAME').default(Resource.Parameters.bucketName).required().asString(),
  SMTP_HOST: e.get('SMTP_HOST').default(Resource.Parameters.smtpHost).required().asString(),
  SMTP_PORT: e.get('SMTP_PORT').default(Resource.Parameters.smtpPort).required().asIntPositive(),
  SMTP_SECURE: e.get('SMTP_SECURE').default(Resource.Parameters.smtpSecure).required().asBool(),
  SMTP_USER: e.get('SMTP_USER').default(Resource.Parameters.smtpUser).required().asString(),
  SMTP_PASS: e.get('SMTP_PASS').default(Resource.Parameters.smtpPass).required().asString(),
  EMAIL_FROM: e.get('EMAIL_FROM').default(Resource.Parameters.emailFrom).required().asString(),
};
