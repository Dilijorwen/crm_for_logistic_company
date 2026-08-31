/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { SystemMessageEvent } from '../model/types';

type Translate = (key: string, values?: Record<string, string | undefined>) => string;

export function formatSystemMessage(event: SystemMessageEvent | null, t: Translate): string {
  if (!event) {
    return t('messages.system');
  }
  return t(`systemMessages.${event.key}`, {
    actorName: event.actorName,
    subjectName: event.subjectName,
    title: event.title,
  });
}
