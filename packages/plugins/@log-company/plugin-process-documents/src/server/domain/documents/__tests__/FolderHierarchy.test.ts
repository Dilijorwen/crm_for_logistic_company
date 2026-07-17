import { describe, expect, it } from 'vitest';
import { assertFolderChainHasNoCycle, assertFolderIsNotItsOwnParent, calculateFolderDepth } from '../FolderHierarchy';

describe('FolderHierarchy', () => {
  it('rejects self-parent and ancestor cycles', () => {
    expect(() => assertFolderIsNotItsOwnParent('1', '1')).toThrowError('Нельзя вложить папку саму в себя.');
    expect(() =>
      assertFolderChainHasNoCycle('1', [
        { id: '2', parentFolderId: '1' },
        { id: '1', parentFolderId: null },
      ]),
    ).toThrowError('Нельзя создать цикл в структуре папок.');
  });

  it('calculates depth without persistence dependencies', () => {
    const descendants = [
      { id: '2', parentFolderId: '1' },
      { id: '3', parentFolderId: '2' },
    ];
    expect(calculateFolderDepth(descendants[1], descendants)).toBe(1);
  });
});
