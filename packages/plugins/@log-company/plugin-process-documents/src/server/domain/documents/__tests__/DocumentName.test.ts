import { describe, expect, it } from 'vitest';
import {
  createUniqueDocumentName,
  decodeUploadedName,
  safeStorageExtension,
  sanitizeDocumentName,
  splitRelativeDocumentName,
} from '../DocumentName';

describe('DocumentName', () => {
  it('normalizes paths and preserves nested upload folders', () => {
    expect(splitRelativeDocumentName('Договоры/2026/контракт.pdf')).toEqual({
      folders: ['Договоры', '2026'],
      filename: 'контракт.pdf',
    });
    expect(sanitizeDocumentName('../опасный\\файл.txt')).toBe('.._опасный_файл.txt');
  });

  it('repairs UTF-8 names decoded as latin1', () => {
    const mojibake = Buffer.from('Документ.pdf', 'utf8').toString('latin1');
    expect(decodeUploadedName(mojibake)).toBe('Документ.pdf');
  });

  it('creates stable unique names and safe storage extensions', () => {
    expect(createUniqueDocumentName('invoice.pdf', ['invoice.pdf', 'invoice (1).pdf'], true)).toBe('invoice (2).pdf');
    expect(createUniqueDocumentName('Договоры', ['Договоры'], false)).toBe('Договоры (1)');
    expect(safeStorageExtension('archive.TAR.GZ')).toBe('.gz');
    expect(safeStorageExtension('payload.<script>')).toBe('.script');
  });
});
