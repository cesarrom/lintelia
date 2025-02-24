import { ENVIRONMENT_TOKEN } from "../injector/tokens";
import { injectable, inject } from "tsyringe";
import { env } from "../constants";
import { S3 } from "aws-sdk";

@injectable()
export class FilesService {
  private _s3?: S3;

  constructor(
    @inject(ENVIRONMENT_TOKEN) private _env: typeof env
  ) {}

  private get s3() {
    if (!this._s3) {
      this._s3 = new S3({
        region: this._env.AWS_REGION,
        credentials: {
          accessKeyId: this._env.AWS_KEY,
          secretAccessKey: this._env.AWS_SECRET,
        },
      });
    }

    return this._s3;
  }

  async uploadFile(file: Buffer, name: string) {
    return this.s3.upload({
      Bucket: this._env.BUCKET_NAME,
      Key: name,
      Body: file,
    }).promise()
  }

  async downloadFile(path: string) {
    console.log(path);
    const object = await this.s3.getObject({
      Bucket: this._env.BUCKET_NAME,
      'Key': path,
    }).promise();
    console.log('downloaded successfully');

    return Buffer.from(object.Body as Uint8Array);
  }

  async getSignedUrl(path: string) {
    return this.s3.getSignedUrlPromise('getObject', {
      Bucket: this._env.BUCKET_NAME,
      Key: path,
      Expires: 3600, // URL expires in 1 hour
    });

  }

  async downloadWithMetadataFile(path: string) {
    console.log(path);
    const object = await this.s3.getObject({
      Bucket: this._env.BUCKET_NAME,
      'Key': path,
    }).promise();
    console.log('downloaded successfully');

    return { ...object, Body: await this.getSignedUrl(path), ContentDisposition: object.ContentDisposition };
  }
}