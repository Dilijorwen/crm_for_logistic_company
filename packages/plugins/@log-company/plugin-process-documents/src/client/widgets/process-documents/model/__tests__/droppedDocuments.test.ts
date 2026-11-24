/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { droppedDocuments } from '../droppedDocuments';

describe('Перетаскивание папки', () => {
  it('сохраняет вложенный путь и читает все порции содержимого', async () => {
    const file = new File(['contract'], 'Договор.txt');
    const other = new File(['notes'], 'Заметки.txt');
    const fileEntry = (item: File) => ({
      name: item.name,
      isFile: true,
      file: (resolve: (file: File) => void) => resolve(item),
    });
    const directory = (name: string, pages: unknown[][]) => ({
      name,
      isDirectory: true,
      createReader: () => ({ readEntries: (resolve: (page: unknown[]) => void) => resolve(pages.shift() ?? []) }),
    });
    const tree = directory('Контракты', [[directory('Поставка', [[fileEntry(file)]])], [fileEntry(other)]]);
    const transfer = { items: [{ webkitGetAsEntry: () => tree }] } as unknown as DataTransfer;
    await expect(droppedDocuments(transfer)).resolves.toEqual([
      { file, name: 'Контракты/Поставка/Договор.txt' },
      { file: other, name: 'Контракты/Заметки.txt' },
    ]);
  });
});
