"use server";

import { getContextualInjector } from "@/lib/injector/action";
import { FilesService } from "@/lib/services/files.service";

export const downloadFile = async (fileKey: string) => {
  const { injector } = await getContextualInjector();
  const filesService = injector.resolve(FilesService);
  const file = await filesService.downloadWithMetadataFile(fileKey);

  return file;
}

export const downloadFileContents = async (fileKey: string, encoding: BufferEncoding) => {
  const { injector } = await getContextualInjector()
  const filesService = injector.resolve(FilesService);
  const file = await filesService.downloadFile(fileKey);

  return file.toString(encoding);
}

const cleanBase64 = (base64: string) => {
  // Handle data URL (e.g., "data:image/jpeg;base64,/9j/4AAQSkZJRg...")
  if (base64.includes('data:')) {
    return base64.split(',')[1];
  }

  // Handle base64url (remove URL safe characters)
  return base64;


}

export const uploadFile = async (base64Ref: string, name: string) => {
  const { injector } = await getContextualInjector();
  const filesService = injector.resolve(FilesService);
  const base64 = cleanBase64(base64Ref);
  console.log(base64.length, 'base64');
  const { Key } = await filesService.uploadFile(
    Buffer.from(base64, 'base64'),
    name
  );

  return Key;
}

export const putFile = async (fileKey: string, base64Ref: string) => {
  const base64 = cleanBase64(base64Ref);
  const { injector } = await getContextualInjector();
  const filesService = injector.resolve(FilesService);
  await filesService.putFile(Buffer.from(base64, 'base64'), fileKey);
  
  return filesService.getSignedUrl(fileKey);
}


export type AWSFile = Awaited<ReturnType<typeof downloadFile>>;
