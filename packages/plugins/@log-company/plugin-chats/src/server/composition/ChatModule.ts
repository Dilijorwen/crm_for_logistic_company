/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import { AddChatMembers } from '../application/AddChatMembers';
import { ChatAccessService } from '../application/ChatAccessService';
import { CreateDirectChat } from '../application/CreateDirectChat';
import { CreateGroupChat } from '../application/CreateGroupChat';
import { DeleteChatMessage } from '../application/DeleteChatMessage';
import { DownloadChatAttachment } from '../application/DownloadChatAttachment';
import { GetChat } from '../application/GetChat';
import { GetChatMessages } from '../application/GetChatMessages';
import { GetUnreadChatsCount } from '../application/GetUnreadChatsCount';
import { GetUserChats } from '../application/GetUserChats';
import { HandleDeletedUser } from '../application/HandleDeletedUser';
import { LeaveChat } from '../application/LeaveChat';
import { MarkChatAsRead } from '../application/MarkChatAsRead';
import { RemoveChatMember } from '../application/RemoveChatMember';
import { SearchChatUsers } from '../application/SearchChatUsers';
import { SendChatMessage } from '../application/SendChatMessage';
import { UpdateGroupChat } from '../application/UpdateGroupChat';
import { UploadChatAttachments } from '../application/UploadChatAttachments';
import { NodeFileTypeDetector } from '../infrastructure/files/NodeFileTypeDetector';
import { NocoBaseChatLogger } from '../infrastructure/nocobase/NocoBaseChatLogger';
import { NocoBaseIdGenerator } from '../infrastructure/nocobase/NocoBaseIdGenerator';
import { NocoBaseTransactionManager } from '../infrastructure/nocobase/NocoBaseTransactionManager';
import { NocoBaseUserDirectory } from '../infrastructure/nocobase/NocoBaseUserDirectory';
import { SystemClock } from '../infrastructure/nocobase/SystemClock';
import { NocoBaseChatAttachmentRepository } from '../infrastructure/persistence/nocobase/NocoBaseChatAttachmentRepository';
import { NocoBaseChatMemberRepository } from '../infrastructure/persistence/nocobase/NocoBaseChatMemberRepository';
import { NocoBaseChatMessageRepository } from '../infrastructure/persistence/nocobase/NocoBaseChatMessageRepository';
import { NocoBaseChatRepository } from '../infrastructure/persistence/nocobase/NocoBaseChatRepository';
import { MinioChatStorage, readChatMinioConfig } from '../infrastructure/storage/minio/MinioChatStorage';
import { ChatUserHooks } from '../interfaces/hooks/ChatUserHooks';
import { ChatController } from '../interfaces/http/ChatController';

export class ChatModule {
  constructor(private readonly plugin: Plugin) {}

  async initialize(): Promise<void> {
    const chats = new NocoBaseChatRepository(this.plugin);
    const members = new NocoBaseChatMemberRepository(this.plugin);
    const messages = new NocoBaseChatMessageRepository(this.plugin);
    const attachments = new NocoBaseChatAttachmentRepository(this.plugin);
    const users = new NocoBaseUserDirectory(this.plugin);
    const transactions = new NocoBaseTransactionManager(this.plugin);
    const clock = new SystemClock();
    const ids = new NocoBaseIdGenerator(this.plugin);
    const storage = new MinioChatStorage(readChatMinioConfig(process.env));
    const logger = new NocoBaseChatLogger(this.plugin);
    const access = new ChatAccessService(chats, members);

    const actions = {
      createDirect: new CreateDirectChat(chats, members, users, transactions, clock, ids),
      createGroup: new CreateGroupChat(chats, members, users, transactions, clock, ids),
      getUserChats: new GetUserChats(chats),
      getChat: new GetChat(access, chats, members),
      addMembers: new AddChatMembers(access, chats, members, messages, users, transactions, clock, ids),
      removeMember: new RemoveChatMember(access, chats, members, messages, users, transactions, clock, ids),
      leave: new LeaveChat(access, chats, members, messages, users, transactions, clock, ids),
      updateGroup: new UpdateGroupChat(access, chats, messages, users, transactions, clock, ids),
      searchUsers: new SearchChatUsers(users),
      sendMessage: new SendChatMessage(access, chats, messages, users, transactions, clock, ids),
      deleteMessage: new DeleteChatMessage(access, messages, transactions, clock),
      getMessages: new GetChatMessages(access, messages, attachments),
      markRead: new MarkChatAsRead(access, members, transactions, clock),
      unreadCount: new GetUnreadChatsCount(members),
      uploadAttachments: new UploadChatAttachments(
        access,
        chats,
        messages,
        attachments,
        users,
        storage,
        logger,
        transactions,
        clock,
        ids,
      ),
      downloadAttachment: new DownloadChatAttachment(access, attachments, messages, storage, logger),
    };

    await storage.ensureReady();
    new ChatController(this.plugin, actions, new NodeFileTypeDetector(), logger).register();
    new ChatUserHooks(this.plugin, new HandleDeletedUser(chats, members, messages, transactions, clock)).register();
  }
}
