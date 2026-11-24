/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { SelectedDocument } from '../../../entities/process-document';
import { MAX_DOCUMENT_UPLOAD_ENTRIES as maxFiles } from '../../../../contracts/processDocuments';

const maxDepth = 20;

export async function droppedDocuments(transfer: DataTransfer): Promise<SelectedDocument[]> {
  return (await readDroppedDocuments(transfer)).files;
}

export async function readDroppedDocuments(transfer: DataTransfer) {
  const items = Array.from(transfer.items ?? [], (item) => {
    const entry = item.webkitGetAsEntry?.();
    return { entry, file: entry ? null : item.getAsFile?.() };
  });
  if (!items.some(({ entry }) => entry)) {
    const files = Array.from(transfer.files, (file) => ({ file, name: file.webkitRelativePath || file.name }));
    if (files.length > maxFiles) throw new Error(`Можно загрузить не более ${maxFiles} файлов и папок за раз.`);
    return { files, emptyFolders: [] };
  }
  const files: SelectedDocument[] = [];
  const emptyFolders: string[] = [];
  function checkLimit() {
    if (files.length + emptyFolders.length >= maxFiles)
      throw new Error(`Можно загрузить не более ${maxFiles} файлов и папок за раз.`);
  }
  async function read(entry: FileSystemEntry, prefix = '') {
    const name = prefix + entry.name;
    if (name.split('/').length > maxDepth) throw new Error('Слишком глубокая вложенность папок.');
    if (entry.isFile) {
      checkLimit();
      const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
      files.push({ file, name });
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      let isEmpty = true;
      for (;;) {
        const children = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
        if (!children.length) break;
        isEmpty = false;
        for (const child of children) await read(child, name + '/');
      }
      if (isEmpty) {
        checkLimit();
        emptyFolders.push(name);
      }
    }
  }
  for (const { entry, file } of items) {
    if (entry) await read(entry);
    else if (file) {
      checkLimit();
      files.push({ file, name: file.webkitRelativePath || file.name });
    }
  }
  return { files, emptyFolders };
}
