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
    "HOST": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "ONFIDO_TOKEN": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "ONFIDO_WORKFLOW_ID": {
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
      "databaseAuthToken": string
      "databaseId": string
      "databaseName": string
      "databaseUrl": string
      "descopeProjectId": string
      "domain": string
      "host": string
      "onfidoToken": string
      "onfidoWorkflowId": string
      "type": "sst.sst.Linkable"
    }
    "Site": {
      "type": "sst.aws.Nextjs"
      "url": string
    }
  }
}
export {}
