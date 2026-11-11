/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import less from 'less';
import { parse } from 'postcss';
import type { Root } from 'postcss';
import { beforeAll, describe, expect, it } from 'vitest';

describe('organization connectors', () => {
  let stylesheet: Root;

  beforeAll(async () => {
    const sourcePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../styles.less');
    stylesheet = parse((await less.render(readFileSync(sourcePath, 'utf8'))).css);
  });

  function declarations(selector: string): Record<string, string> {
    const result: Record<string, string> = {};
    stylesheet.walkRules((rule) => {
      if (rule.selectors.includes(selector)) {
        rule.walkDecls((declaration) => {
          result[declaration.prop] = declaration.value;
        });
      }
    });
    return result;
  }

  it('draws thin stems as borders so fractional zoom does not discard a one-pixel background', () => {
    for (const selector of ['.lc-org-tree__children::after', '.lc-org-add-child::before']) {
      const styles = declarations(selector);
      expect(styles.width).toBe('0');
      expect(styles['border-left']).toBe('1px solid var(--colorBorder, #d9d9d9)');
      expect(styles.background).toBeUndefined();
    }
  });

  it('joins adjacent subtrees at their centers even when their widths differ', () => {
    const before = declarations('.lc-org-tree__children > .lc-org-tree__group::before');
    const after = declarations('.lc-org-tree__children > .lc-org-tree__group::after');
    const gap = Number.parseFloat(declarations('.lc-org-tree__children').gap);

    expect(before.right).toBe('50%');
    expect(after.left).toBe('50%');
    expect(before.width).toBe(`calc(50% + ${gap / 2}px)`);
    expect(after.width).toBe(before.width);
    expect(before['border-top']).toBe('1px solid var(--colorBorder, #d9d9d9)');
    expect(after['border-top']).toBe(before['border-top']);
  });

  it('ends the horizontal rail at its first and last child and keeps a single-child stem', () => {
    expect(declarations('.lc-org-tree__children > .lc-org-tree__group:first-child::before').display).toBe('none');
    expect(declarations('.lc-org-tree__children > .lc-org-tree__group:last-child::after').display).toBe('none');
    expect(declarations('.lc-org-tree__children > .lc-org-tree__group:only-child::after')).toMatchObject({
      display: 'block',
      width: '0',
      'border-top': '0',
    });
  });

  it('draws a single vertical border for middle children instead of two adjoining borders', () => {
    const before = declarations('.lc-org-tree__children > .lc-org-tree__group::before');
    const after = declarations('.lc-org-tree__children > .lc-org-tree__group::after');
    const lastBefore = declarations('.lc-org-tree__children > .lc-org-tree__group:last-child::before');

    expect(before['border-right']).toBeUndefined();
    expect(after['border-left']).toBe('1px solid var(--colorBorder, #d9d9d9)');
    expect(lastBefore['border-right']).toBe(after['border-left']);
  });
});
