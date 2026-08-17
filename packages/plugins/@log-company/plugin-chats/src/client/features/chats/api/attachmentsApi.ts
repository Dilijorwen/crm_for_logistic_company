/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { APIClient } from '@nocobase/client';
import type { ChatMessage } from '../model/types';
import { unwrapResponse } from './apiResponse';

export async function uploadChatAttachments(
  api: APIClient,
  chatId: string,
  text: string,
  files: File[],
): Promise<ChatMessage> {
  const data = new FormData();
  data.append('chatId', chatId);
  data.append('text', text);
  files.forEach((file) => data.append('files', file, file.name));
  return unwrapResponse<ChatMessage>(await api.request({ url: 'chatAttachments:upload', method: 'post', data }));
}

export async function downloadChatAttachment(api: APIClient, attachmentId: string, fileName: string): Promise<void> {
  const response = await api.request({
    url: 'chatAttachments:download',
    method: 'get',
    params: { attachmentId },
    responseType: 'blob',
  });
  if (!(response.data instanceof Blob)) {
    throw new Error('Attachment response is not a binary object.');
  }
  const blob = response.data;
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.URL.revokeObjectURL(objectUrl);
  }
}
