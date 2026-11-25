/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TemporaryDocumentDrafts } from '../TemporaryDocumentDrafts';

const form = { resource: 'our_companies', recordId: null } as const;
const staged = async (dir: string) => {
  const filePath = path.join(dir, 'file');
  await writeFile(filePath, 'test');
  return { files: [{ path: filePath, originalName: 'Контракты/Договор.txt', size: 4, mimeType: 'text/plain' }] };
};

describe('Временные файлы формы', () => {
  let root: string;
  let drafts: TemporaryDocumentDrafts;
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'temp-document-test-'));
    drafts = new TemporaryDocumentDrafts(root, () => undefined);
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('сохраняет файлы на диске для повторного сохранения и удаляет при отмене', async () => {
    const batch = await drafts.stage('1', form, staged);
    const session = drafts.acquire([batch.token], '1', form);
    const [file] = session.destinations[0].files;
    expect(file.originalName).toBe('Контракты/Договор.txt');
    expect(await readFile(file.path, 'utf8')).toBe('test');
    await session.release();
    const retry = drafts.acquire([batch.token], '1', form);
    await retry.release();
    await drafts.discard([batch.token], '1');
    expect(await readdir(root)).toEqual([]);
  });

  it('разрешает завершить только сохранение той же записи и того же пользователя', async () => {
    const batch = await drafts.stage('1', form, staged);
    expect(() => drafts.acquire([batch.token], '2', form)).toThrow();
    await expect(drafts.discard([batch.token], '2')).rejects.toThrow();
    expect(() => drafts.acquire([batch.token], '1', { ...form, recordId: '10' })).toThrow();
    expect(() => drafts.acquire([batch.token], '1', { ...form, resource: 'contracts' })).toThrow();
    const session = drafts.acquire([batch.token], '1', form);
    expect(() => drafts.acquire([batch.token], '1', form)).toThrow();
    await session.release(true);
    expect(await readdir(root)).toEqual([]);
    expect(() => drafts.acquire([batch.token], '1', form)).toThrow();
  });

  it('автоматически удаляет забытый черновик без запроса отмены', async () => {
    vi.useFakeTimers();
    try {
      await drafts.start();
      const batch = await drafts.stage('1', form, staged);
      expect(await readdir(root)).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(2 * 60 * 60 * 1000);
      await vi.waitFor(async () => expect(await readdir(root)).toEqual([]));
      expect(() => drafts.acquire([batch.token], '1', form)).toThrow();
    } finally {
      drafts.stop();
      vi.useRealTimers();
    }
  });
});
