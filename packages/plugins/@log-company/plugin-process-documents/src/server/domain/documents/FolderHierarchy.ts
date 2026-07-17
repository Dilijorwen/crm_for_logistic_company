import { ProcessDocumentsError } from './DocumentErrors';

export interface FolderNode {
  id: string;
  parentFolderId: string | null;
}

export function assertFolderIsNotItsOwnParent(folderId: string | null, parentFolderId: string | null): void {
  if (folderId !== null && parentFolderId === folderId) {
    throw new ProcessDocumentsError('FOLDER_SELF_PARENT', 'Нельзя вложить папку саму в себя.');
  }
}

export function assertFolderChainHasNoCycle(folderId: string | null, parentChain: FolderNode[]): void {
  const seen = new Set<string>();
  for (const folder of parentChain) {
    if (folder.id === folderId || seen.has(folder.id)) {
      throw new ProcessDocumentsError('FOLDER_CYCLE', 'Нельзя создать цикл в структуре папок.');
    }
    seen.add(folder.id);
  }
}

export function calculateFolderDepth(folder: FolderNode, descendants: FolderNode[]): number {
  const byId = new Map(descendants.map((item) => [item.id, item]));
  let depth = 0;
  let parentId = folder.parentFolderId;
  while (parentId && byId.has(parentId)) {
    depth += 1;
    parentId = byId.get(parentId)?.parentFolderId ?? null;
  }
  return depth;
}
