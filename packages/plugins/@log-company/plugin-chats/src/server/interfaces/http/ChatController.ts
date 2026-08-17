/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import type { ChatLogger } from '../../application/ports/ChatLogger';
import type { FileTypeDetector } from '../../application/ports/FileTypeDetector';
import type { ChatActions } from './ChatActions';
import { ChatAttachmentsController } from './ChatAttachmentsController';
import { ChatHttpSupport } from './ChatHttpSupport';
import { ChatMessagesController } from './ChatMessagesController';
import { ChatsController } from './ChatsController';

const CHAT_ACTION_NAMES = [
  'list',
  'get',
  'createDirect',
  'createGroup',
  'addMembers',
  'removeMember',
  'leave',
  'updateGroup',
  'unreadCount',
  'availableUsers',
];

export class ChatController {
  constructor(
    private readonly plugin: Plugin,
    private readonly chatActions: ChatActions,
    private readonly fileTypes: FileTypeDetector,
    private readonly logger: ChatLogger,
  ) {}

  register(): void {
    const http = new ChatHttpSupport(this.logger);
    const chats = new ChatsController(this.chatActions, http);
    const messages = new ChatMessagesController(this.chatActions, http);
    const attachments = new ChatAttachmentsController(this.chatActions, http, this.fileTypes, this.logger);

    this.plugin.app.resourceManager.define({ name: 'chats', actions: chats.actions });
    this.plugin.app.resourceManager.define({ name: 'chatMessages', actions: messages.actions });
    this.plugin.app.resourceManager.define({ name: 'chatAttachments', actions: attachments.actions });

    this.plugin.app.acl.allow('chats', CHAT_ACTION_NAMES, 'loggedIn');
    this.plugin.app.acl.allow('chatMessages', ['list', 'send', 'delete', 'markRead'], 'loggedIn');
    this.plugin.app.acl.allow('chatAttachments', ['upload', 'download'], 'loggedIn');
  }
}
