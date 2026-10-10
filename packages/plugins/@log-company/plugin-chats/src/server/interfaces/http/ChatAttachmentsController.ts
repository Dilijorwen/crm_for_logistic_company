/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { Context, Next } from '@nocobase/actions';
import { koaMulter as multer } from '@nocobase/utils';
import { CHAT_LIMITS } from '../../../shared/chatLimits';
import type { UploadedChatFile } from '../../application/UploadChatAttachments';
import type { ChatLogger } from '../../application/ports/ChatLogger';
import type { FileTypeDetector } from '../../application/ports/FileTypeDetector';
import { decodeUploadedFileName } from '../../infrastructure/files/UploadedFileName';
import type { ChatActions } from './ChatActions';
import type { ChatHttpSupport } from './ChatHttpSupport';
import { canPreviewInline } from '@log-company/plugin-file-storage';

interface UploadedFile {
  path: string;
  originalname: string;
  mimetype?: string;
  size: number;
}

type UploadContext = Context & { files?: UploadedFile[] };

export class ChatAttachmentsController {
  private readonly upload = multer({
    dest: path.join(os.tmpdir(), 'log-company-chat-uploads'),
    limits: {
      files: CHAT_LIMITS.maximumAttachmentsPerMessage,
      fileSize: CHAT_LIMITS.maximumAttachmentSizeBytes,
    },
  }).array('files', CHAT_LIMITS.maximumAttachmentsPerMessage);

  constructor(
    private readonly chatActions: ChatActions,
    private readonly http: ChatHttpSupport,
    private readonly fileTypes: FileTypeDetector,
    private readonly logger: ChatLogger,
  ) {}

  private readonly uploadAttachments = async (context: UploadContext, next: Next): Promise<void> => {
    await this.http.handle(context, async () => {
      try {
        await this.upload(context, async () => undefined);
        const files = context.files || [];
        const values = this.http.values(context);
        const detected = await Promise.all(files.map((file) => this.toUploadedFile(file)));
        context.body = await this.chatActions.uploadAttachments.execute({
          chatId: this.http.requiredId(values.chatId),
          actorId: this.http.actorId(context),
          text: typeof values.text === 'string' ? values.text : null,
          files: detected,
        });
        await next();
      } finally {
        await this.removeTemporaryFiles(context.files || []);
      }
    });
  };

  private readonly downloadAttachment = async (context: Context, next: Next): Promise<void> => {
    await this.http.handle(context, async () => {
      const values = this.http.values(context);
      const result = await this.chatActions.downloadAttachment.execute(
        this.http.requiredId(values.attachmentId ?? values.id),
        this.http.actorId(context),
      );
      context.set('Content-Type', result.mimeType);
      context.set('Content-Length', String(result.size));
      const disposition =
        context.action.actionName === 'preview' && canPreviewInline(result.mimeType) ? 'inline' : 'attachment';
      context.set('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(result.fileName)}`);
      context.set('X-Content-Type-Options', 'nosniff');
      context.set('Cache-Control', 'private, no-store');
      context.body = result.content;
      await next();
    });
  };

  private async toUploadedFile(file: UploadedFile): Promise<UploadedChatFile> {
    const originalName = decodeUploadedFileName(file.originalname);
    return {
      filePath: file.path,
      originalName,
      declaredMimeType: file.mimetype || 'application/octet-stream',
      detectedMimeType: await this.fileTypes.detect(file.path, originalName),
      size: file.size,
    };
  }

  private async removeTemporaryFiles(files: UploadedFile[]): Promise<void> {
    await Promise.all(
      files.map(async (file) => {
        try {
          await fs.unlink(file.path);
        } catch (error) {
          this.logger.warn('chat_temporary_file_cleanup_failed', { error: String(error) });
        }
      }),
    );
  }

  readonly actions = {
    upload: this.uploadAttachments,
    download: this.downloadAttachment,
    preview: this.downloadAttachment,
  };
}
