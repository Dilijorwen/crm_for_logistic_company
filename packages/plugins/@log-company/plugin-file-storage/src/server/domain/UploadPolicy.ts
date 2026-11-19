/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

const megabyte = 1024 * 1024;

interface UploadProfile {
  maxFiles: number;
  maxFileBytes: number;
  maxTotalBytes: number;
  maxPathSegments: number;
  allowNativeFormats?: boolean;
}

export const processDocumentUpload: UploadProfile = {
  maxFiles: 100,
  maxFileBytes: 50 * megabyte,
  maxTotalBytes: 250 * megabyte,
  maxPathSegments: 20,
};

export const nativeAttachmentUpload: UploadProfile = {
  maxFiles: 1,
  maxFileBytes: 100 * megabyte,
  maxTotalBytes: 100 * megabyte,
  maxPathSegments: 1,
  allowNativeFormats: true,
};

export class InvalidUploadError extends Error {}

export function isControlCharacter(character: string): boolean {
  const code = character.charCodeAt(0);
  return code < 32 || code === 127;
}

export function validateUploadBatch(files: ReadonlyArray<{ size: number }>, profile: UploadProfile): void {
  if (files.length > profile.maxFiles) {
    throw new InvalidUploadError(`Можно загрузить не более ${profile.maxFiles} файлов за раз.`);
  }
  let total = 0;
  for (const { size } of files) {
    if (!Number.isSafeInteger(size) || size < 0 || size > profile.maxFileBytes) {
      throw new InvalidUploadError(`Размер файла не может превышать ${profile.maxFileBytes / megabyte} МБ.`);
    }
    total += size;
  }
  if (total > profile.maxTotalBytes) {
    throw new InvalidUploadError(`Общий размер загрузки не может превышать ${profile.maxTotalBytes / megabyte} МБ.`);
  }
}

export function validateUploadName(relativeName: string, profile: UploadProfile): string {
  const parts = relativeName.split(/[\\/]/).map((part) => part.trim());
  if (
    /^[a-z]:/i.test(relativeName.trim()) ||
    parts.length > profile.maxPathSegments ||
    parts.some(
      (part) =>
        !part || part === '.' || part === '..' || part.length > 200 || Array.from(part).some(isControlCharacter),
    )
  ) {
    throw new InvalidUploadError('Слишком длинный или недопустимый путь в загружаемой папке.');
  }
  return parts[parts.length - 1];
}

type FileType = { mime: string; signatures?: readonly string[]; signatureOffset?: number };
const zip = ['504b0304', '504b0506', '504b0708'];
const office = ['d0cf11e0a1b11ae1'];
const types: Readonly<Record<string, FileType>> = {
  '.pdf': { mime: 'application/pdf', signatures: ['255044462d'] },
  '.zip': { mime: 'application/zip', signatures: zip },
  '.rar': { mime: 'application/vnd.rar', signatures: ['526172211a07'] },
  '.7z': { mime: 'application/x-7z-compressed', signatures: ['377abcaf271c'] },
  '.docx': { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', signatures: zip },
  '.xlsx': { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', signatures: zip },
  '.pptx': { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', signatures: zip },
  '.ods': { mime: 'application/vnd.oasis.opendocument.spreadsheet', signatures: zip },
  '.odt': { mime: 'application/vnd.oasis.opendocument.text', signatures: zip },
  '.doc': { mime: 'application/msword', signatures: office },
  '.xls': { mime: 'application/vnd.ms-excel', signatures: office },
  '.jpg': { mime: 'image/jpeg', signatures: ['ffd8ff'] },
  '.jpeg': { mime: 'image/jpeg', signatures: ['ffd8ff'] },
  '.png': { mime: 'image/png', signatures: ['89504e470d0a1a0a'] },
  '.tif': { mime: 'image/tiff', signatures: ['49492a00', '4d4d002a'] },
  '.tiff': { mime: 'image/tiff', signatures: ['49492a00', '4d4d002a'] },
  '.xml': { mime: 'application/xml' },
  '.txt': { mime: 'text/plain' },
  '.csv': { mime: 'text/csv' },
  '.eml': { mime: 'message/rfc822' },
  '.msg': { mime: 'application/vnd.ms-outlook', signatures: office },
};

const attachmentTypes: Readonly<Record<string, FileType>> = {
  '.gif': { mime: 'image/gif', signatures: ['474946383761', '474946383961'] },
  '.ppt': { mime: 'application/vnd.ms-powerpoint', signatures: office },
  '.rtf': { mime: 'application/rtf', signatures: ['7b5c727466'] },
  '.mp4': { mime: 'video/mp4', signatures: ['66747970'], signatureOffset: 4 },
};

export function uploadExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot <= 0 ? '' : filename.slice(dot).toLowerCase();
}

export function validateUploadSample(
  filename: string,
  header: string,
  containsNull: boolean,
  profile: UploadProfile = processDocumentUpload,
): string {
  const extension = uploadExtension(filename);
  const type = types[extension] ?? (profile.allowNativeFormats ? attachmentTypes[extension] : undefined);
  if (!type) throw new InvalidUploadError('Файл имеет неподдерживаемое расширение.');
  const matches = type.signatures
    ? type.signatures.some((signature) => header.startsWith(signature, (type.signatureOffset ?? 0) * 2))
    : !containsNull || (extension === '.xml' && (header.startsWith('fffe') || header.startsWith('feff')));
  if (!matches) throw new InvalidUploadError('Содержимое файла не соответствует формату.');
  return type.mime;
}
