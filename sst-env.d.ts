/* tslint:disable */
/* eslint-disable */
import "sst"
declare module "sst" {
  export interface Resource {
    "Bucket": {
      "name": string
      "type": "sst.aws.Bucket"
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
    "Next": {
      "type": "sst.aws.Nextjs"
      "url": string
    }
  }
}
export {}
