import { eq } from "drizzle-orm";
import { files } from "../models/platform.sql";
import { type PlatformDB } from "./tenants.service";
import { ENVIRONMENT_TOKEN, PLATFORM_DB_TOKEN } from "../libs/injector/tokens";
import { Autowire, Injectable } from "ts-injection";
import { env } from "../constants";
import { S3 } from "aws-sdk";

@Injectable()
export class FilesService {
  @Autowire(PLATFORM_DB_TOKEN)
  private db: PlatformDB;

  @Autowire(ENVIRONMENT_TOKEN)
  private _env: typeof env


  private _s3: S3;

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


  async createFile(fileData: Omit<typeof files.$inferInsert, 'path'> & { file: Buffer }) {
    const { file } = fileData;

    const result = await this.uploadFile(file, fileData.name);

    const [res] = await this.db.insert(files).values({
      ...fileData,
      path: result.Key,
    }).returning();

    return res;
  }

  async getFileById(id: number) {
    return await this.db
      .select()
      .from(files)
      .where(eq(files.id, id))
      .limit(1)
      .then((res) => res[0] || null);
  }

  async updateFile(id: number, fileData: Partial<typeof files.$inferInsert>) {
    return await this.db
      .update(files)
      .set(fileData)
      .where(eq(files.id, id))
      .returning();
  }

  async deleteFile(id: number) {
    return await this.db.delete(files).where(eq(files.id, id)).returning();
  }

  async getAllFiles() {
    return await this.db.select().from(files);
  }
}