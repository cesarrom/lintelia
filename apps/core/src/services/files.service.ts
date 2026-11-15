import { S3 } from "aws-sdk";
import { AbstractService } from "./service";
import { ENV } from "../injector/tokens/env.token";
import { type AppEnvironment } from "../constants";
import { Injectable, Inject, Scope } from "@nestjs/common";

@Injectable({
  scope: Scope.REQUEST
})
export class FilesService extends AbstractService {
  private _s3?: S3;

  constructor(
    @Inject(ENV) private env: AppEnvironment,
  ) {
    super();
  }

  private get s3() {
    if (!this._s3) {
      this._s3 = new S3({
        region: this.env.AWS_REGION,
        credentials: {
          accessKeyId: this.env.AWS_KEY,
          secretAccessKey: this.env.AWS_SECRET,
        },
      });
    }

    return this._s3;
  }

async putFile(file: File, path: string) {
  return this.s3.putObject({
    Bucket: this.env.BUCKET_NAME,
    Key: path,
    Body: file,
    ContentType: this.getContentType(path)
  }).promise();
}

private getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    'pdf': 'application/pdf',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'txt': 'text/plain',
    'csv': 'text/csv',
    'json': 'application/json',
    'xml': 'application/xml',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };
  
  return ext && mimeTypes[ext] ? mimeTypes[ext] : 'application/octet-stream';
}


  async uploadFile(file: Buffer, name: string) {
    return this.s3.upload({
      Bucket: this.env.BUCKET_NAME,
      Key: name,
      Body: file,
    }).promise()
  }

  async downloadFile(path: string) {
    console.log(path);
    const object = await this.s3.getObject({
      Bucket: this.env.BUCKET_NAME,
      'Key': path,
    }).promise();
    console.log('downloaded successfully');

    return Buffer.from(object.Body as Uint8Array);
  }

  async getSignedUrl(path: string) {
    return this.s3.getSignedUrlPromise('getObject', {
      Bucket: this.env.BUCKET_NAME,
      Key: path,
      Expires: 3600, // URL expires in 1 hour
    });

  }

  async downloadWithMetadataFile(path: string) {
    console.log(path);
    const object = await this.s3.getObject({
      Bucket: this.env.BUCKET_NAME,
      'Key': path,
    }).promise();
    console.log('downloaded successfully');

    return { ...object, Body: await this.getSignedUrl(path), ContentDisposition: object.ContentDisposition };
  }
}