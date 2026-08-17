/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { ChatValidationError } from '../domain/chat/ChatErrors';
import type { MessageCursor } from './ports/ChatMessageRepository';

export function encodeMessageCursor(cursor: MessageCursor): string {
  return encodeURIComponent(`${cursor.createdAt}|${cursor.id}`);
}

export function decodeMessageCursor(value: string | null | undefined): MessageCursor | null {
  if (!value) {
    return null;
  }
  try {
    const decoded = decodeURIComponent(value);
    const separator = decoded.lastIndexOf('|');
    const createdAt = separator > 0 ? decoded.slice(0, separator) : '';
    const id = separator > 0 ? decoded.slice(separator + 1) : '';
    if (Number.isNaN(Date.parse(createdAt)) || !/^\d+$/.test(id)) {
      throw new ChatValidationError();
    }
    return { createdAt, id };
  } catch (error) {
    if (error instanceof ChatValidationError) {
      throw error;
    }
    throw new ChatValidationError();
  }
}
