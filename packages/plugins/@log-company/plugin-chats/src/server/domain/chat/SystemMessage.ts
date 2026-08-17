/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { SystemMessageEvent, SystemMessageKey } from './ChatTypes';

const SYSTEM_MESSAGE_KEYS = new Set<SystemMessageKey>([
  'memberAdded',
  'memberRemoved',
  'memberLeft',
  'groupTitleChanged',
]);

export function serializeSystemMessage(event: SystemMessageEvent): string {
  return JSON.stringify(event);
}

export function parseSystemMessage(value: string | null): SystemMessageEvent | null {
  if (!value) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    const candidate = parsed as Record<string, unknown>;
    if (
      typeof candidate.key !== 'string' ||
      !SYSTEM_MESSAGE_KEYS.has(candidate.key as SystemMessageKey) ||
      typeof candidate.actorName !== 'string'
    ) {
      return null;
    }
    return {
      key: candidate.key as SystemMessageKey,
      actorName: candidate.actorName,
      subjectName: typeof candidate.subjectName === 'string' ? candidate.subjectName : undefined,
      title: typeof candidate.title === 'string' ? candidate.title : undefined,
    };
  } catch {
    return null;
  }
}
