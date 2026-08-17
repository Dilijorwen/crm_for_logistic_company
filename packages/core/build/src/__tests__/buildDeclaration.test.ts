/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildDeclaration } from '../buildDeclaration';

const temporaryDirectories: string[] = [];

async function createPackage(source: string): Promise<string> {
  const packagePath = await fs.mkdtemp(path.join(os.tmpdir(), 'nocobase-declaration-'));
  temporaryDirectories.push(packagePath);
  const sourcePath = path.join(packagePath, 'src');
  await fs.mkdir(sourcePath);
  await fs.writeFile(path.join(sourcePath, 'index.ts'), source);
  return packagePath;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })),
  );
});

describe('buildDeclaration', () => {
  it('uses workspace paths for type checking without emitting dependency declarations', async () => {
    const packagePath = await createPackage(
      "import type * as NocoBaseUtils from '@nocobase/utils';\nexport type UtilsModule = typeof NocoBaseUtils;\n",
    );

    await buildDeclaration(packagePath, 'dist');

    await expect(fs.readFile(path.join(packagePath, 'dist/index.d.ts'), 'utf8')).resolves.toContain(
      "import type * as NocoBaseUtils from '@nocobase/utils';",
    );
    await expect(fs.readdir(path.join(packagePath, 'dist'))).resolves.toEqual(['index.d.ts']);
  });

  it('reports type errors from the package being built', async () => {
    const packagePath = await createPackage('export const invalidValue: string = 42;\n');

    await expect(buildDeclaration(packagePath, 'dist')).rejects.toThrow(
      "Type 'number' is not assignable to type 'string'",
    );
  });

  it('does not suppress imports outside the package source directory', async () => {
    const packagePath = await createPackage("export { sharedValue } from '../shared';\n");
    await fs.writeFile(path.join(packagePath, 'shared.ts'), "export const sharedValue = 'shared';\n");

    await expect(buildDeclaration(packagePath, 'dist')).rejects.toThrow("is not under 'rootDir'");
  });
});
