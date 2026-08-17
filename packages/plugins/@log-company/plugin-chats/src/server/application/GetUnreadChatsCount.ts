/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { ChatMemberRepository } from './ports/ChatMemberRepository';

export class GetUnreadChatsCount {
  constructor(private readonly members: ChatMemberRepository) {}

  execute(actorId: string): Promise<number> {
    return this.members.countUnreadChats(actorId);
  }
}
