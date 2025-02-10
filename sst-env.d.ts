/* tslint:disable */
/* eslint-disable */
import "sst"
declare module "sst" {
  export interface Resource {
    "AWS_HOSTED_ZONE_ID": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "AWS_KEY": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "AWS_REGION": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "AWS_SECRET": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "Bucket": {
      "name": string
      "type": "sst.aws.Bucket"
    }
    "DESCOPE_MANAGEMENT_KEY": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "DESCOPE_PROJECT_ID": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "Database": {
      "clusterArn": string
      "database": string
      "host": string
      "password": string
      "port": number
      "secretArn": string
      "type": "sst.aws.Postgres"
      "username": string
    }
    "DatabaseAuthToken": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "DatabaseId": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "DatabaseName": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "DatabaseUrl": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "DynamoScheduler": {
      "name": string
      "type": "sst.aws.Dynamo"
    }
    "EMAIL_FROM": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "ExecutionQueue": {
      "type": "sst.aws.Queue"
      "url": string
    }
    "HOST": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "KYC_ENDPOINT": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "KYC_SECRET": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "KYC_TOKEN": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "KYC_WORKFLOW_ID": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "Parameters": {
      "awsCertificateArn": string
      "awsHostedZoneId": string
      "awsKey": string
      "awsRegion": string
      "awsSecret": string
      "baseDomain": string
      "bucketArn": string
      "bucketDomain": string
      "bucketName": string
      "databaseAuthToken": string
      "databaseId": string
      "databaseName": string
      "databaseUrl": string
      "descopeManagementKey": string
      "descopeProjectId": string
      "domain": string
      "emailFrom": string
      "host": string
      "kycEndpoint": string
      "kycSecret": string
      "kycToken": string
      "kycWorkflowId": string
      "smtpHost": string
      "smtpPass": string
      "smtpPort": string
      "smtpSecure": string
      "smtpUser": string
      "type": "sst.sst.Linkable"
    }
    "SMTP_HOST": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "SMTP_PASS": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "SMTP_PORT": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "SMTP_SECURE": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "SMTP_USER": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "Site": {
      "type": "sst.aws.Nextjs"
      "url": string
    }
  }
}
export {}
