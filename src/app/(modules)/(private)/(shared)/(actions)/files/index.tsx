"use server";

import { compressFileUntil } from "@/lib/file-utils";
import { getContextualInjector } from "@/lib/injector/action";
import { FilesService } from "@/lib/services/files.service";

export const downloadFile = async (fileKey: string) => {
  const { injector } = await getContextualInjector();
  const filesService = injector.resolve(FilesService);
  const file = await filesService.downloadWithMetadataFile(fileKey);

  return file;
}

export const downloadFileContents = async (fileKey: string) => {
  const { injector } = await getContextualInjector()
  const filesService = injector.resolve(FilesService);
  const buffer = await filesService.downloadFile(fileKey);
  const { ContentType } = await filesService.downloadWithMetadataFile(fileKey);
  const file = new File([buffer], fileKey);
  const headersList = new Headers();
  headersList.append('Content-Disposition', `attachment; filename="${fileKey}"`);
  headersList.append('Content-Type', ContentType || 'application/octet-stream');

  return new Response(file, {
    headers: headersList,
  });
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

const fileToBuffer = async (file: File): Promise<Buffer> => {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export const putFile = async (fileKey: string, form: FormData) => {
  const uncompressedFile = form.get(fileKey) as File;
  const file = await compressFileUntil(uncompressedFile, 4 * 1024 * 1024, 0.5);
  const buffer = await fileToBuffer(file);
  const { injector } = await getContextualInjector();
  const filesService = injector.resolve(FilesService);
  await filesService.putFile(buffer, fileKey);
  const metadata = await filesService.downloadFile(fileKey);

  console.log('base64 of length: ', metadata.toString('base64').length);
  console.log('size in bytes: ', metadata.byteLength);


  return filesService.getSignedUrl(fileKey);
}


export type AWSFile = Awaited<ReturnType<typeof downloadFile>>;
