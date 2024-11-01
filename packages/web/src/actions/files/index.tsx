"use server";

import { getInjector } from "@fintivio-sst/core/libs";
import { FilesService } from "@fintivio-sst/core/services";

export const downloadFile = async (domain: string, fileKey: string) => {
  const injector = await getInjector(domain);
  const filesService = injector.resolve(FilesService);
  const file = await filesService.downloadWithMetadataFile(fileKey);

  return file;
}

export const downloadFileContents = async (domain: string, fileKey: string, encoding: BufferEncoding) => {
  const injector = await getInjector(domain);
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
    return base64.replace(/-/g, '+').replace(/_/g, '/');
  
  
}

export const uploadFile = async (domain: string, base64: string, name: string) => {
  const injector = await getInjector(domain);
  const filesService = injector.resolve(FilesService);

  const { Key } = await filesService.uploadFile(
    Buffer.from(cleanBase64(base64), 'base64'),
    name
  );

  return Key;
}

export type AWSFile = Awaited<ReturnType<typeof downloadFile>>;
