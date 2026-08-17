/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { expect, test, type Page } from '@nocobase/test/e2e';

interface UserRecord {
  id: string | number;
  nickname: string;
  username: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function responseId(value: unknown): string {
  const response = asRecord(value);
  const data = asRecord(response.data);
  const payload = asRecord(Object.prototype.hasOwnProperty.call(data, 'data') ? data.data : response.data);
  return String(payload.id || '');
}

async function createUsers(
  mockRecords: <T>(collectionName: string, values: unknown[]) => Promise<T[]>,
  names: string[],
): Promise<UserRecord[]> {
  const token = Math.random().toString(36).slice(2, 10);
  return mockRecords<UserRecord>(
    'users',
    names.map((nickname, index) => ({
      nickname: `${nickname} ${token}-${index}`,
      username: `chat-e2e-${token}-${index}`,
      password: 'ChatE2ePassword123!',
    })),
  );
}

async function createDirectChat(page: Page, participantName: string): Promise<void> {
  await page.getByRole('button', { name: 'New chat' }).click();
  const userSelect = page.getByRole('combobox', { name: 'Participant' });
  await userSelect.click();
  await userSelect.fill(participantName);
  await page.getByRole('option', { name: participantName }).click();
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name: participantName })).toBeVisible();
}

test.describe('CRM chats', () => {
  test('creates and reopens one direct chat, then sends and soft-deletes a message', async ({ page, mockRecords }) => {
    const [participant] = await createUsers(mockRecords, ['Direct chat participant']);
    await page.goto('/admin/chats');

    await createDirectChat(page, participant.nickname);
    await page.getByLabel('Write a message').fill('Direct message from Playwright');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByRole('log', { name: 'Messages' }).getByText('Direct message from Playwright')).toBeVisible();

    await createDirectChat(page, participant.nickname);
    await expect(page.getByRole('button', { name: `Open chat ${participant.nickname}` })).toHaveCount(1);

    await page.getByRole('button', { name: 'Delete message' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByRole('log', { name: 'Messages' }).getByText('Message deleted')).toBeVisible();
  });

  test('creates a group and records participant additions and removals', async ({ page, mockRecords }) => {
    const [initialMember, addedMember] = await createUsers(mockRecords, ['Initial group member', 'Added group member']);
    await page.goto('/admin/chats');
    await page.getByRole('button', { name: 'New chat' }).click();
    await page.getByText('Group chat', { exact: true }).click();
    await page.getByLabel('Chat title').fill('Playwright operations group');
    const participants = page.getByRole('combobox', { name: 'Participants' });
    await participants.click();
    await participants.fill(initialMember.nickname);
    await page.getByRole('option', { name: initialMember.nickname }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('heading', { name: 'Playwright operations group' })).toBeVisible();

    await page.getByRole('button', { name: 'Manage participants' }).click();
    const addParticipant = page.getByRole('combobox', { name: 'Add participant' });
    await addParticipant.click();
    await addParticipant.fill(addedMember.nickname);
    await page.getByRole('option', { name: addedMember.nickname }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Add participant' }).click();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByText(`Super Admin added ${addedMember.nickname}`)).toBeVisible();

    await page.getByRole('button', { name: 'Manage participants' }).click();
    const addedMemberRow = page.getByRole('listitem').filter({ hasText: addedMember.nickname });
    await addedMemberRow.getByRole('button', { name: 'Remove participant' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByText(`Super Admin removed ${addedMember.nickname}`)).toBeVisible();
  });

  test('uploads and downloads an attachment', async ({ page, mockRecords }) => {
    const [participant] = await createUsers(mockRecords, ['Attachment participant']);
    await page.goto('/admin/chats');
    await createDirectChat(page, participant.nickname);

    await page.locator('input[type="file"]').setInputFiles({
      name: 'shipping-note.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('shipping note from Playwright', 'utf8'),
    });
    await page.getByRole('button', { name: 'Send' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download shipping-note.txt' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('shipping-note.txt');
  });

  test('shows unread state, forbids deleting another author message, and handles a deleted user', async ({
    page,
    browser,
    mockRecords,
  }) => {
    const [participant] = await createUsers(mockRecords, ['Disposable chat participant']);
    await page.goto('/admin/chats');
    await createDirectChat(page, participant.nickname);
    await page.getByLabel('Write a message').fill('Unread foreign message');
    const sendResponsePromise = page.waitForResponse((response) => response.url().includes('chatMessages:send'));
    await page.getByRole('button', { name: 'Send' }).click();
    const sendPayload: unknown = await (await sendResponsePromise).json();
    const messageId = responseId(sendPayload);
    expect(messageId).not.toBe('');

    const participantContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const participantPage = await participantContext.newPage();
    await participantPage.goto('/');
    await participantPage.getByPlaceholder('Username/Email').fill(participant.username);
    await participantPage.getByPlaceholder('Password').fill('ChatE2ePassword123!');
    await participantPage.getByRole('button', { name: 'Sign in' }).click();
    await expect(participantPage.getByTestId('user-center-button')).toBeVisible();
    await participantPage.goto('/admin/chats');
    const rootChat = participantPage.getByRole('button', { name: 'Open chat Super Admin' });
    await expect(rootChat.locator('.ant-badge-count')).toHaveText('1');
    await rootChat.click();
    await expect(participantPage.getByText('Unread foreign message')).toBeVisible();
    await expect(participantPage.getByRole('button', { name: 'Delete message' })).toHaveCount(0);

    const participantToken = await participantPage.evaluate(() => window.localStorage.getItem('NOCOBASE_TOKEN'));
    const forbiddenDelete = await participantPage.request.post('/api/chatMessages:delete', {
      headers: { Authorization: `Bearer ${participantToken}` },
      data: { messageId },
    });
    expect(forbiddenDelete.status()).toBe(403);
    await participantContext.close();

    const rootToken = await page.evaluate(() => window.localStorage.getItem('NOCOBASE_TOKEN'));
    const deleteUserResponse = await page.request.delete(`/api/users:destroy?filterByTk=${participant.id}`, {
      headers: { Authorization: `Bearer ${rootToken}` },
    });
    expect(deleteUserResponse.ok()).toBe(true);
    await page.reload();
    await page.getByRole('button', { name: `Open chat ${participant.nickname}` }).click();
    await expect(page.getByText('User deleted').first()).toBeVisible();
    await expect(page.getByLabel('Write a message')).toBeDisabled();
  });
});
