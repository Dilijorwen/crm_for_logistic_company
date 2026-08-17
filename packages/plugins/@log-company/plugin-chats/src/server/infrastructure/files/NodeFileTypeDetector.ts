/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import fs from 'fs/promises';
import type { FileHandle } from 'fs/promises';
import { TextDecoder } from 'util';
import type { FileTypeDetector } from '../../application/ports/FileTypeDetector';

const PROBE_SIZE_BYTES = 64 * 1024;
const TEXT_SCAN_CHUNK_BYTES = 64 * 1024;

const OFFICE_ZIP_MIME: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const OFFICE_OLE_MIME: Record<string, string> = {
  doc: 'application/msword',
  ppt: 'application/vnd.ms-powerpoint',
  xls: 'application/vnd.ms-excel',
};

const OFFICE_ZIP_DIRECTORY: Record<string, string> = {
  docx: 'word/',
  pptx: 'ppt/',
  xlsx: 'xl/',
};

function startsWith(buffer: Buffer, bytes: readonly number[]): boolean {
  return bytes.every((byte, index) => buffer[index] === byte);
}

async function isUtf8Text(handle: FileHandle, size: number): Promise<boolean> {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const buffer = Buffer.alloc(TEXT_SCAN_CHUNK_BYTES);
  let offset = 0;
  try {
    while (offset < size) {
      const { bytesRead } = await handle.read(buffer, 0, Math.min(buffer.length, size - offset), offset);
      if (!bytesRead) {
        break;
      }
      const chunk = buffer.subarray(0, bytesRead);
      if (chunk.includes(0)) {
        return false;
      }
      decoder.decode(chunk, { stream: offset + bytesRead < size });
      offset += bytesRead;
    }
    decoder.decode();
    return true;
  } catch (error) {
    if (error instanceof TypeError) {
      return false;
    }
    throw error;
  }
}

export class NodeFileTypeDetector implements FileTypeDetector {
  async detect(filePath: string, fileName: string): Promise<string> {
    const handle = await fs.open(filePath, 'r');
    try {
      const { size } = await handle.stat();
      const buffer = Buffer.alloc(Math.min(PROBE_SIZE_BYTES, size));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      const content = buffer.subarray(0, bytesRead);
      const extension = fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase();
      if (startsWith(content, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf';
      if (startsWith(content, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
      if (startsWith(content, [0xff, 0xd8, 0xff])) return 'image/jpeg';
      if (
        content.subarray(0, 6).toString('ascii') === 'GIF87a' ||
        content.subarray(0, 6).toString('ascii') === 'GIF89a'
      ) {
        return 'image/gif';
      }
      if (content.subarray(0, 4).toString('ascii') === 'RIFF' && content.subarray(8, 12).toString('ascii') === 'WEBP') {
        return 'image/webp';
      }
      if (startsWith(content, [0x50, 0x4b, 0x03, 0x04]) && OFFICE_ZIP_MIME[extension]) {
        const tailSize = Math.min(PROBE_SIZE_BYTES, size);
        const tail = Buffer.alloc(tailSize);
        await handle.read(tail, 0, tailSize, Math.max(0, size - tailSize));
        const zipDirectory = `${content.toString('latin1')}\n${tail.toString('latin1')}`;
        if (zipDirectory.includes('[Content_Types].xml') && zipDirectory.includes(OFFICE_ZIP_DIRECTORY[extension])) {
          return OFFICE_ZIP_MIME[extension];
        }
        return 'application/octet-stream';
      }
      if (startsWith(content, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) && OFFICE_OLE_MIME[extension]) {
        return OFFICE_OLE_MIME[extension];
      }
      if ((extension === 'txt' || extension === 'csv') && (await isUtf8Text(handle, size))) {
        return extension === 'csv' ? 'text/csv' : 'text/plain';
      }
      return 'application/octet-stream';
    } finally {
      await handle.close();
    }
  }
}
