import dotenv from 'dotenv';
dotenv.config();
import DescopeClient from '@descope/node-sdk';
import fetch from 'node-fetch';
import envVar from 'env-var';
import { Resource as R } from 'sst';
import assert from 'assert';
import { exec } from 'child_process';

const startServerCommand = process.argv[2];

const noop = () => { };

const Resource = new Proxy(R, {
  get: (target, prop) => {
    try {
      return target[prop];
    } catch {
      return new Proxy({}, {
        get() {
          return '-'
        }
      });
    }
  }
});

const e = envVar.from(process.env, {}, noop);

const env = {
  PORT: e.get('PORT').default('3000').asIntPositive(),
  HOST: e.get('HOST').default(Resource.Parameters.host).asString(),
  AWS_KEY: e.get('AWS_KEY').default(Resource.Parameters.awsKey).required().asString(),
  AWS_SECRET: e.get('AWS_SECRET').default(Resource.Parameters.awsSecret).required().asString(),
  AWS_REGION: e.get('AWS_REGION').default(Resource.Parameters.awsRegion).required().asString(),
  DESCOPE_PROJECT_ID: e.get('DESCOPE_PROJECT_ID').default(Resource.Parameters.descopeProjectId).required().asString(),
  DESCOPE_MANAGEMENT_KEY: e.get('DESCOPE_MANAGEMENT_KEY').default(Resource.Parameters.descopeManagementKey).required().asString(),
  AWS_HOSTED_ZONE_ID: e.get('AWS_HOSTED_ZONE_ID').default(Resource.Parameters.awsHostedZoneId).required().asString(),
  BASE_DOMAIN: e.get('BASE_DOMAIN').default(Resource.Parameters.baseDomain).required().asString(),
  DOMAIN: e.get('DOMAIN').default(Resource.Parameters.domain).required().asString(),
  DATABASE_ID: e.get('DATABASE_ID').default(Resource.Parameters.tenantDatabaseId).required().asString(),
  DATABASE_URL: e.get('DATABASE_URL').default(Resource.Parameters.tenantDatabaseUrl).required().asString(),
  DATABASE_PASSWORD: e.get('DATABASE_PASSWORD').default(Resource.Parameters.tenantDatabasePassword).required().asString(),
  KYC_TOKEN: e.get('KYC_TOKEN').default(Resource.Parameters.kycToken).required().asString(),
  KYC_SECRET: e.get('KYC_SECRET').default(Resource.Parameters.kycSecret).required().asString(),
  KYC_WORKFLOW_ID: e.get('KYC_WORKFLOW_ID').default(Resource.Parameters.kycWorkflowId).required().asString(),
  KYC_ENDPOINT: e.get('KYC_ENDPOINT').default(Resource.Parameters.kycEndpoint).required().asString(),
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
  DATABASE_CORE_URL: e.get('DATABASE_CORE_URL').default(Resource.Parameters.coreDatabaseUrl).required().asString(),
  DATABASE_CORE_PASSWORD: e.get('DATABASE_CORE_PASSWORD').default(Resource.Parameters.coreDatabasePassword).required().asString(),
  DATABASE_API_KEY: e.get('DATABASE_API_KEY').default(Resource.Parameters.databaseApiKey).required().asString(),
  DATABASE_PROJECT_ID: e.get('DATABASE_PROJECT_ID').default(Resource.Parameters.databaseProjectId).required().asString(),
  OPENAI_API_KEY: e.get('OPENAI_API_KEY').default(Resource.Parameters.openaiApiKey).required().asString(),
  RESTATE_ENDPOINT: e.get('RESTATE_ENDPOINT').default(Resource.Parameters.restateEndpoint).required().asString(),
  RESTATE_ADMIN_ENDPOINT: e.get('RESTATE_ADMIN_ENDPOINT').default(Resource.Parameters.restateAdminEndpoint || 'none').required().asString(),
};

console.log('\x1b[36mInitializing Descope client...\x1b[0m');
const auth = DescopeClient({ projectId: env.DESCOPE_PROJECT_ID, managementKey: env.DESCOPE_MANAGEMENT_KEY });

console.log('\x1b[36mSearching for user...\x1b[0m');
const usersResponse = await auth.management.user.search({
  emails: ['admin@example.com'],
});
const [user] = usersResponse.data || [];
assert(user, 'User not found');
console.log('\x1b[32mUser found:\x1b[0m', user.email);

const [loginId] = user.loginIds || [];
assert(loginId, 'Login id not found');
console.log('\x1b[32mLogin ID found:\x1b[0m', loginId);

console.log('\x1b[36mSigning in to obtain JWT...\x1b[0m');
const jwtResponse = await auth.management.jwt.signIn(loginId);
const jwt = jwtResponse.data?.sessionJwt;
assert(jwt, 'JWT not found');
console.log('\x1b[32mJWT obtained successfully\x1b[0m');

console.log('\x1b[36mStarting server...\x1b[0m');
const serverProcess = exec(startServerCommand, (error, stdout, stderr) => {
  if (error) {
    console.error('\x1b[31mFailed to start server:\x1b[0m', error);
    process.exit(1);
  }
  console.log('\x1b[32mServer started successfully\x1b[0m');
});

// now we forward logs and errors to the console
serverProcess.stdout?.on('data', (data) => process.stdout.write(data));
serverProcess.stderr?.on('data', (data) => process.stderr.write(data));

console.log('\x1b[36mWaiting for host\x1b[0m', env.HOST, '\x1b[36mto be available...\x1b[0m');

const finish = () => {
  console.log('\x1b[33mServer process killed\x1b[0m');
  serverProcess.kill();
};

process.on('SIGINT', () => {
  finish();
  process.exit(0);
});

process.on('SIGTERM', () => {
  finish();
  process.exit(0);
});

process.on('exit', () => {
  finish();
});

const checkPort = async () => {
  try {
    const response = await fetch(`${env.HOST}/workflows/v1/anything`);
    if (response.status === 404) {
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
};

let portAvailable = await checkPort();
const startTime = Date.now();

while (!portAvailable) {
  await new Promise(resolve => setTimeout(resolve, 1000));
  if (Date.now() - startTime > 60000) {
    console.error('\x1b[31mHost\x1b[0m', env.HOST, '\x1b[31mis not available after 60 seconds\x1b[0m');
    process.exit(1);
  }
  portAvailable = await checkPort();
}

console.log('\x1b[32mHost\x1b[0m', env.HOST, '\x1b[32mis available\x1b[0m');

console.log('\x1b[36mDeploying to Restate admin endpoint...\x1b[0m');
const response = await fetch(`${env.RESTATE_ADMIN_ENDPOINT}/deployments`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwt}`
  },
  body: JSON.stringify({
    uri: env.HOST + 'workflows/v1',
    force: true,
    use_http_11: true,
    additional_headers: {
      Authorization: `Bearer ${jwt}`,
      Cookie: `DS=${jwt}`
    }
  })
});

if (!response.ok) {
  console.error('\x1b[31mFailed to deploy to Restate admin endpoint\x1b[0m');
  process.exit(1);
}

console.log('\x1b[32mDeployment request sent successfully\x1b[0m');
