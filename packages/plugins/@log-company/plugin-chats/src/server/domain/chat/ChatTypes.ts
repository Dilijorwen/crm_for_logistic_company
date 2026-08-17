/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export type ChatType = 'direct' | 'group';
export type ChatMemberRole = 'owner' | 'admin' | 'member';
export type ChatMessageType = 'text' | 'system' | 'file';

export type SystemMessageKey = 'memberAdded' | 'memberRemoved' | 'memberLeft' | 'groupTitleChanged';

export interface SystemMessageEvent {
  key: SystemMessageKey;
  actorName: string;
  subjectName?: string;
  title?: string;
}
