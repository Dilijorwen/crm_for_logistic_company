/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Readable } from 'node:stream';
import type { Plugin } from '@nocobase/server';
import type { Context, Next } from '@nocobase/actions';
import { FileStorageError } from '../domain/FileStorageError';
import { fileResponseHeaders } from './fileResponseHeaders';
import {
  InvalidFileLinkError,
  OpenStoredAttachment,
  StoredAttachmentNotFoundError,
} from '../application/OpenStoredAttachment';

export class FileStorageController {
  constructor(
    private readonly plugin: Plugin,
    private readonly openAttachment: OpenStoredAttachment,
  ) {}

  register(): void {
    this.plugin.app.resourceManager.define({ name: 'fileStorage', actions: { open: this.open } });
    // Links are short-lived capabilities issued by file-manager after its normal ACL checks.
    this.plugin.app.acl.allow('fileStorage', 'open', 'public');
  }

  private readonly open = async (context: Context, next: Next): Promise<void> => {
    try {
      await this.respond(context);
    } catch (error) {
      if (error instanceof InvalidFileLinkError) context.throw(403, 'Ссылка на файл истекла или недействительна.');
      if (error instanceof StoredAttachmentNotFoundError) context.throw(404, 'Файл не найден.');
      if (error instanceof FileStorageError && error.code === 'not-found') context.throw(404, error.message);
      this.plugin.log.error('Не удалось открыть вложение из единого хранилища.', { err: error });
      context.throw(503, 'Файл временно недоступен. Повторите попытку позже.');
    }
    await next();
  };

  private async respond(context: Context): Promise<void> {
    const { id, expires, signature } = context.action.params;
    const file = await this.openAttachment.execute({ id, expires, signature });
    const headers = fileResponseHeaders({ ...file, preview: true });
    for (const [name, value] of Object.entries(headers)) context.set(name, value);
    context.body = Readable.from(file.stream);
  }
}
