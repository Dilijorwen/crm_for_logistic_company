/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { AddChatMembers } from '../../application/AddChatMembers';
import type { CreateDirectChat } from '../../application/CreateDirectChat';
import type { CreateGroupChat } from '../../application/CreateGroupChat';
import type { DeleteChatMessage } from '../../application/DeleteChatMessage';
import type { DownloadChatAttachment } from '../../application/DownloadChatAttachment';
import type { GetChat } from '../../application/GetChat';
import type { GetChatMessages } from '../../application/GetChatMessages';
import type { GetUnreadChatsCount } from '../../application/GetUnreadChatsCount';
import type { GetUserChats } from '../../application/GetUserChats';
import type { LeaveChat } from '../../application/LeaveChat';
import type { MarkChatAsRead } from '../../application/MarkChatAsRead';
import type { RemoveChatMember } from '../../application/RemoveChatMember';
import type { SearchChatUsers } from '../../application/SearchChatUsers';
import type { SendChatMessage } from '../../application/SendChatMessage';
import type { UpdateGroupChat } from '../../application/UpdateGroupChat';
import type { UploadChatAttachments } from '../../application/UploadChatAttachments';

export interface ChatActions {
  createDirect: CreateDirectChat;
  createGroup: CreateGroupChat;
  getUserChats: GetUserChats;
  getChat: GetChat;
  addMembers: AddChatMembers;
  removeMember: RemoveChatMember;
  leave: LeaveChat;
  updateGroup: UpdateGroupChat;
  searchUsers: SearchChatUsers;
  sendMessage: SendChatMessage;
  deleteMessage: DeleteChatMessage;
  getMessages: GetChatMessages;
  markRead: MarkChatAsRead;
  unreadCount: GetUnreadChatsCount;
  uploadAttachments: UploadChatAttachments;
  downloadAttachment: DownloadChatAttachment;
}
