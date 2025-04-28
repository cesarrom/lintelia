import { injectable, inject } from "tsyringe";
import { S3 } from "aws-sdk";
import { EnvironmentsService } from "./environments.service";
import { Service } from "./service";

@injectable()
export class FilesService extends Service {
  private _s3?: S3;

  static dependencies() {
    return [
      EnvironmentsService
    ]
  }

  constructor(
    @inject(EnvironmentsService) private environmentsService: EnvironmentsService
  ) {
    super();
  }

  private get s3() {
    if (!this._s3) {
      this._s3 = new S3({
        region: this.environmentsService.env.AWS_REGION,
        credentials: {
          accessKeyId: this.environmentsService.env.AWS_KEY,
          secretAccessKey: this.environmentsService.env.AWS_SECRET,
        },
      });
    }

    return this._s3;
  }

async putFile(file: Buffer, path: string) {
  return this.s3.putObject({
    Bucket: this.environmentsService.env.BUCKET_NAME,
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
      Bucket: this.environmentsService.env.BUCKET_NAME,
      Key: name,
      Body: file,
    }).promise()
  }

  async downloadFile(path: string) {
    console.log(path);
    const object = await this.s3.getObject({
      Bucket: this.environmentsService.env.BUCKET_NAME,
      'Key': path,
    }).promise();
    console.log('downloaded successfully');

    return Buffer.from(object.Body as Uint8Array);
  }

  async getSignedUrl(path: string) {
    return this.s3.getSignedUrlPromise('getObject', {
      Bucket: this.environmentsService.env.BUCKET_NAME,
      Key: path,
      Expires: 3600, // URL expires in 1 hour
    });

  }

  async downloadWithMetadataFile(path: string) {
    console.log(path);
    const object = await this.s3.getObject({
      Bucket: this.environmentsService.env.BUCKET_NAME,
      'Key': path,
    }).promise();
    console.log('downloaded successfully');

    return { ...object, Body: await this.getSignedUrl(path), ContentDisposition: object.ContentDisposition };
  }
}