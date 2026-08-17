/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Context, Next } from '@nocobase/actions';
import type { ChatActions } from './ChatActions';
import type { ChatHttpSupport } from './ChatHttpSupport';

export class ChatsController {
  constructor(
    private readonly chatActions: ChatActions,
    private readonly http: ChatHttpSupport,
  ) {}

  private readonly listChats = async (context: Context, next: Next): Promise<void> => {
    await this.http.handle(context, async () => {
      context.body = await this.chatActions.getUserChats.execute(this.http.actorId(context));
      await next();
    });
  };

  private readonly getChat = async (context: Context, next: Next): Promise<void> => {
    await this.http.handle(context, async () => {
      const values = this.http.values(context);
      context.body = await this.chatActions.getChat.execute(
        this.http.requiredId(values.chatId ?? values.id),
        this.http.actorId(context),
      );
      await next();
    });
  };

  private readonly createDirect = async (context: Context, next: Next): Promise<void> => {
    await this.http.handle(context, async () => {
      const values = this.http.values(context);
      context.body = await this.chatActions.createDirect.execute({
        actorId: this.http.actorId(context),
        otherUserId: this.http.requiredId(values.otherUserId),
      });
      await next();
    });
  };

  private readonly createGroup = async (context: Context, next: Next): Promise<void> => {
    await this.http.handle(context, async () => {
      const values = this.http.values(context);
      context.body = await this.chatActions.createGroup.execute({
        actorId: this.http.actorId(context),
        title: this.http.requiredString(values.title),
        memberUserIds: this.http.identifierArray(values.memberUserIds),
      });
      await next();
    });
  };

  private readonly addMembers = async (context: Context, next: Next): Promise<void> => {
    await this.http.handle(context, async () => {
      const values = this.http.values(context);
      await this.chatActions.addMembers.execute({
        chatId: this.http.requiredId(values.chatId),
        actorId: this.http.actorId(context),
        userIds: this.http.identifierArray(values.userIds),
      });
      context.body = true;
      await next();
    });
  };

  private readonly removeMember = async (context: Context, next: Next): Promise<void> => {
    await this.http.handle(context, async () => {
      const values = this.http.values(context);
      await this.chatActions.removeMember.execute({
        chatId: this.http.requiredId(values.chatId),
        actorId: this.http.actorId(context),
        userId: this.http.requiredId(values.userId),
      });
      context.body = true;
      await next();
    });
  };

  private readonly leaveChat = async (context: Context, next: Next): Promise<void> => {
    await this.http.handle(context, async () => {
      const values = this.http.values(context);
      await this.chatActions.leave.execute(this.http.requiredId(values.chatId), this.http.actorId(context));
      context.body = true;
      await next();
    });
  };

  private readonly updateGroup = async (context: Context, next: Next): Promise<void> => {
    await this.http.handle(context, async () => {
      const values = this.http.values(context);
      await this.chatActions.updateGroup.execute(
        this.http.requiredId(values.chatId),
        this.http.actorId(context),
        this.http.requiredString(values.title),
      );
      context.body = true;
      await next();
    });
  };

  private readonly unreadCount = async (context: Context, next: Next): Promise<void> => {
    await this.http.handle(context, async () => {
      context.body = { count: await this.chatActions.unreadCount.execute(this.http.actorId(context)) };
      await next();
    });
  };

  private readonly availableUsers = async (context: Context, next: Next): Promise<void> => {
    await this.http.handle(context, async () => {
      const values = this.http.values(context);
      const query = typeof values.query === 'string' ? values.query : '';
      context.body = await this.chatActions.searchUsers.execute(query, this.http.actorId(context));
      await next();
    });
  };

  readonly actions = {
    list: this.listChats,
    get: this.getChat,
    createDirect: this.createDirect,
    createGroup: this.createGroup,
    addMembers: this.addMembers,
    removeMember: this.removeMember,
    leave: this.leaveChat,
    updateGroup: this.updateGroup,
    unreadCount: this.unreadCount,
    availableUsers: this.availableUsers,
  };
}
