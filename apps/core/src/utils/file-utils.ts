import assert from 'assert';
import { fromBlob, ImageFormat, fromURL } from 'image-resize-compress';

const allowedFormats: ImageFormat[] = ['png', 'webp', 'bmp', 'jpeg', 'gif'];

export const base64ToBlob = (base64: string, format: ImageFormat) => {
  const buffer = Buffer.from(base64, 'base64');
  return new Blob([buffer], { type: `image/${format}` });
}

export const blobToBase64 = async (blob: Blob) => {
  return Buffer.from(await blob.arrayBuffer()).toString('base64');
}

const isSupportedFormat = (format: string): format is ImageFormat => allowedFormats.includes(format as ImageFormat);

export const compressFileUntil = async (file: File, sizeInBytes: number, step = 10): Promise<File> => {
  let quality = 100;
  let currentSizeInBytes = file.size;
  const width = 'auto'; // Original width
  const height = 'auto'; // Original height
  const format = file.type.split('/')[1]; // Output format

  let resizedBlob: Blob = file;

  assert(isSupportedFormat(format), 'Invalid image format');

  while (currentSizeInBytes > sizeInBytes && quality > 0) {
    resizedBlob = await fromBlob(file, quality, width, height, format);
    currentSizeInBytes = resizedBlob.size;
    quality -= step;
  }

  assert(resizedBlob.size <= sizeInBytes, 'File too big to reach desired size');

  const resizedFile = new File([resizedBlob], file.name, { type: resizedBlob.type });

  return resizedFile;
}

export const compressBlobUntil = async (file: Blob, sizeInBytes: number, step = 10): Promise<Blob> => {
  let quality = 100;
  let currentSizeInBytes = file.size;
  const width = 'auto'; // Original width
  const height = 'auto'; // Original height
  const format = file.type.split('/')[1]; // Output format

  let resizedBlob: Blob = file;

  assert(isSupportedFormat(format), 'Invalid image format');

  while (currentSizeInBytes > sizeInBytes && quality > 0) {
    resizedBlob = await fromBlob(file, quality, width, height, format);
    currentSizeInBytes = resizedBlob.size;
    quality -= step;
  }

  assert(resizedBlob.size <= sizeInBytes, 'File too big to reach desired size');

  return resizedBlob;
}


export const compressBase64Until = async (base64: string, format: string, sizeInBytes: number, step = 10): Promise<string> => {
  assert(isSupportedFormat(format), 'Invalid image format');
  let quality = 100;
  let currentSizeInBytes = sizeInBytes;
  const width = 'auto'; // Original width
  const height = 'auto'; // Original height
  const blob = base64ToBlob(base64, format);
  let resizedBlob: Blob = blob;

  while (currentSizeInBytes > sizeInBytes && quality > 0) {
    resizedBlob = await fromBlob(blob, quality, width, height, format);
    currentSizeInBytes = resizedBlob.size;
    quality -= step;
  }

  assert(resizedBlob.size <= sizeInBytes, 'File too big to reach desired size');

  const arrayBuffer = await resizedBlob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const newBase64 = buffer.toString('base64');

  return newBase64;
}


