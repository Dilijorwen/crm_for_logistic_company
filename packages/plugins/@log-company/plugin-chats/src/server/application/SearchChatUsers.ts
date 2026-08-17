/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { CHAT_LIMITS } from '../../shared/chatLimits';
import type { ChatUserDto } from './dto/ChatDto';
import type { UserDirectory } from './ports/UserDirectory';

export class SearchChatUsers {
  constructor(private readonly users: UserDirectory) {}

  execute(query: string, actorId: string): Promise<ChatUserDto[]> {
    return this.users.search(
      query.trim().slice(0, CHAT_LIMITS.maximumUserSearchQueryLength),
      actorId,
      CHAT_LIMITS.userSearchResultLimit,
    );
  }
}
