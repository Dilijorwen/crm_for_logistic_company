/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Context, Next } from '@nocobase/actions';
import { CHAT_LIMITS } from '../../../shared/chatLimits';
import type { ChatActions } from './ChatActions';
import type { ChatHttpSupport } from './ChatHttpSupport';

export class ChatMessagesController {
  constructor(
    private readonly chatActions: ChatActions,
    private readonly http: ChatHttpSupport,
  ) {}

  private readonly listMessages = async (context: Context, next: Next): Promise<void> => {
    await this.http.handle(context, async () => {
      const values = this.http.values(context);
      context.body = await this.chatActions.getMessages.execute({
        chatId: this.http.requiredId(values.chatId),
        actorId: this.http.actorId(context),
        cursor: typeof values.cursor === 'string' ? values.cursor : null,
        beforeId: this.http.optionalId(values.beforeId),
        limit: this.http.integer(values.limit, CHAT_LIMITS.defaultMessagePageSize),
      });
      await next();
    });
  };

  private readonly sendMessage = async (context: Context, next: Next): Promise<void> => {
    await this.http.handle(context, async () => {
      const values = this.http.values(context);
      context.body = await this.chatActions.sendMessage.execute({
        chatId: this.http.requiredId(values.chatId),
        actorId: this.http.actorId(context),
        text: this.http.requiredString(values.text),
        replyToMessageId: this.http.optionalId(values.replyToMessageId),
      });
      await next();
    });
  };

  private readonly deleteMessage = async (context: Context, next: Next): Promise<void> => {
    await this.http.handle(context, async () => {
      const values = this.http.values(context);
      await this.chatActions.deleteMessage.execute(
        this.http.requiredId(values.messageId ?? values.id),
        this.http.actorId(context),
      );
      context.body = true;
      await next();
    });
  };

  private readonly markRead = async (context: Context, next: Next): Promise<void> => {
    await this.http.handle(context, async () => {
      const values = this.http.values(context);
      await this.chatActions.markRead.execute(this.http.requiredId(values.chatId), this.http.actorId(context));
      context.body = true;
      await next();
    });
  };

  readonly actions = {
    list: this.listMessages,
    send: this.sendMessage,
    delete: this.deleteMessage,
    markRead: this.markRead,
  };
}
