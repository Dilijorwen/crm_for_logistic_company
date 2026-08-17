/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { MigrationContext } from '@nocobase/database';
import type { Plugin } from '@nocobase/server';
import { createMockServer, type MockServer } from '@nocobase/test';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ChatAccessService } from '../application/ChatAccessService';
import chatMembersCollection from '../collections/chatMembers';
import chatMessageAttachmentsCollection from '../collections/chatMessageAttachments';
import chatMessagesCollection from '../collections/chatMessages';
import chatsCollection from '../collections/chats';
import { ChatAccessDeniedError } from '../domain/chat/ChatErrors';
import { NocoBaseTransactionManager } from '../infrastructure/nocobase/NocoBaseTransactionManager';
import { NocoBaseChatMemberRepository } from '../infrastructure/persistence/nocobase/NocoBaseChatMemberRepository';
import { NocoBaseChatMessageRepository } from '../infrastructure/persistence/nocobase/NocoBaseChatMessageRepository';
import { NocoBaseChatRepository } from '../infrastructure/persistence/nocobase/NocoBaseChatRepository';
import CreateChatSchemaMigration from '../migrations/20260717130000-create-chat-schema';
import EnforceChatSchemaMigration from '../migrations/20260717132000-enforce-chat-schema';

const runPostgresIntegration = process.env.CHAT_POSTGRES_INTEGRATION === '1' && process.env.DB_DIALECT === 'postgres';

interface UserModel {
  get(attribute: string): unknown;
}

describe.runIf(runPostgresIntegration)('chat PostgreSQL repositories', () => {
  let app: MockServer;
  let migration: CreateChatSchemaMigration;
  let enforcementMigration: EnforceChatSchemaMigration;
  let migrationApplied = false;
  let plugin: Plugin;
  let firstUserId: string;
  let secondUserId: string;

  beforeAll(async () => {
    if (!process.env.DB_TEST_PREFIX?.startsWith('chat_test')) {
      throw new Error('Chat integration tests require an isolated DB_TEST_PREFIX beginning with chat_test.');
    }
    app = await createMockServer({
      registerActions: true,
      acl: true,
      plugins: ['error-handler', 'field-sort', 'data-source-main', 'users'],
    });
    for (const collection of [
      chatsCollection,
      chatMembersCollection,
      chatMessagesCollection,
      chatMessageAttachmentsCollection,
    ]) {
      app.db.collection(collection);
    }
    await app.db.sync();
    const context: MigrationContext = {
      db: app.db,
      queryInterface: app.db.sequelize.getQueryInterface(),
      sequelize: app.db.sequelize,
    };
    migration = new CreateChatSchemaMigration(context);
    await migration.up();
    enforcementMigration = new EnforceChatSchemaMigration(context);
    await enforcementMigration.up();
    migrationApplied = true;
    plugin = { db: app.db } as unknown as Plugin;

    const firstUser = (await app.db.getRepository('users').create({
      values: { username: 'chat-integration-first', nickname: 'First integration user' },
    })) as unknown as UserModel;
    const secondUser = (await app.db.getRepository('users').create({
      values: { username: 'chat-integration-second', nickname: 'Second integration user' },
    })) as unknown as UserModel;
    firstUserId = String(firstUser.get('id'));
    secondUserId = String(secondUser.get('id'));
  });

  beforeEach(async () => {
    await app.db.sequelize.query('truncate table chat_message_attachments, chat_messages, chat_members, chats cascade');
  });

  afterAll(async () => {
    if (migration && migrationApplied) {
      await enforcementMigration.down();
      await migration.down();
    }
    if (app) {
      await app.destroy();
    }
  });

  it('creates the required constraints and indexes', async () => {
    const [indexRows] = (await app.db.sequelize.query(
      `select indexname, indexdef
       from pg_indexes
       where tablename in ('chats', 'chat_members', 'chat_messages', 'chat_message_attachments')`,
    )) as unknown as [Array<{ indexname: string; indexdef: string }>, unknown];
    const indexNames = indexRows.map((row) => row.indexname);

    expect(indexNames).toContain('chats_direct_key_unique');
    expect(indexRows.find((row) => row.indexname === 'chats_direct_key_unique')?.indexdef).not.toContain('WHERE');
    expect(indexNames).toContain('chat_members_active_user_unique');
    expect(indexNames).toContain('chat_messages_chat_created_idx');
    expect(indexNames).toContain('chat_message_attachments_storage_key_unique');
    await expect(
      app.db.sequelize.query(
        `insert into chats (id, type, title, direct_key, created_at, updated_at)
         values (910001, 'unsupported', null, null, now(), now())`,
      ),
    ).rejects.toThrow();

    const chats = new NocoBaseChatRepository(plugin);
    const transactions = new NocoBaseTransactionManager(plugin);
    await transactions.execute(async (transaction) => {
      await expect(
        chats.createDirectIfAbsent(
          {
            id: '910011',
            type: 'direct',
            title: null,
            directKey: 'integration-direct-key',
            createdById: firstUserId,
            now: new Date('2026-07-17T03:00:00.000Z'),
          },
          transaction,
        ),
      ).resolves.toMatchObject({ id: '910011' });
      await expect(
        chats.createDirectIfAbsent(
          {
            id: '910012',
            type: 'direct',
            title: null,
            directKey: 'integration-direct-key',
            createdById: firstUserId,
            now: new Date('2026-07-17T03:00:00.000Z'),
          },
          transaction,
        ),
      ).resolves.toBeNull();
    });
  });

  it('rolls back related repository writes on failure', async () => {
    const chats = new NocoBaseChatRepository(plugin);
    const transactions = new NocoBaseTransactionManager(plugin);

    await expect(
      transactions.execute(async (transaction) => {
        await chats.create(
          {
            id: '920001',
            type: 'group',
            title: 'Rollback test',
            directKey: null,
            createdById: firstUserId,
            now: new Date('2026-07-17T03:00:00.000Z'),
          },
          transaction,
        );
        throw new Error('force rollback');
      }),
    ).rejects.toThrow('force rollback');

    await expect(chats.findById('920001')).resolves.toBeNull();
  });

  it('enforces chat access, nullable user references, unread counts, and cursor pagination', async () => {
    const chats = new NocoBaseChatRepository(plugin);
    const members = new NocoBaseChatMemberRepository(plugin);
    const messages = new NocoBaseChatMessageRepository(plugin);
    const transactions = new NocoBaseTransactionManager(plugin);
    const joinedAt = new Date('2026-07-17T03:00:00.000Z');

    await transactions.execute(async (transaction) => {
      await chats.create(
        {
          id: '930001',
          type: 'group',
          title: 'Repository integration',
          directKey: null,
          createdById: firstUserId,
          now: joinedAt,
        },
        transaction,
      );
      await members.create(
        {
          id: '930011',
          chatId: '930001',
          userId: firstUserId,
          memberName: 'First integration user',
          role: 'owner',
          joinedAt,
          lastReadAt: joinedAt,
        },
        transaction,
      );
      await members.create(
        {
          id: '930012',
          chatId: '930001',
          userId: secondUserId,
          memberName: 'Second integration user',
          role: 'member',
          joinedAt,
          lastReadAt: joinedAt,
        },
        transaction,
      );
      await messages.create(
        {
          id: '930021',
          chatId: '930001',
          authorId: firstUserId,
          authorName: 'First integration user',
          text: 'First message',
          messageType: 'text',
          replyToMessageId: null,
          createdAt: new Date('2026-07-17T03:01:00.000Z'),
        },
        transaction,
      );
      await messages.create(
        {
          id: '930022',
          chatId: '930001',
          authorId: secondUserId,
          authorName: 'Second integration user',
          text: 'Second message',
          messageType: 'text',
          replyToMessageId: null,
          createdAt: new Date('2026-07-17T03:02:00.000Z'),
        },
        transaction,
      );
      await chats.updateLastMessageAt('930001', new Date('2026-07-17T03:02:00.000Z'), transaction);
    });

    const access = new ChatAccessService(chats, members);
    await expect(access.requireActiveMember('930001', firstUserId)).resolves.toMatchObject({
      chat: { id: '930001' },
    });
    await expect(access.requireActiveMember('930001', '999999999')).rejects.toBeInstanceOf(ChatAccessDeniedError);
    await expect(members.countUnreadChats(firstUserId)).resolves.toBe(1);

    const newestPage = await messages.list('930001', null, 1, firstUserId);
    expect(newestPage.map((message) => message.id)).toEqual(['930022']);
    const olderPage = await messages.list(
      '930001',
      { createdAt: new Date(newestPage[0].createdAt).toISOString(), id: newestPage[0].id },
      1,
      firstUserId,
    );
    expect(olderPage.map((message) => message.id)).toEqual(['930021']);

    await app.db.getRepository('users').destroy({ filterByTk: secondUserId });
    const deletedMembership = await members.listByChat('930001');
    const deletedAuthorMessage = await messages.findById('930022');
    expect(deletedMembership.find((member) => member.memberName === 'Second integration user')).toMatchObject({
      userId: null,
      deleted: true,
    });
    expect(deletedAuthorMessage).toMatchObject({
      authorId: null,
      authorName: 'Second integration user',
      text: 'Second message',
    });
  });
});
