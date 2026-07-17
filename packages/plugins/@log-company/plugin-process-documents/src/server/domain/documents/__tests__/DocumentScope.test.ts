import { describe, expect, it } from 'vitest';
import { ProcessDocumentsError } from '../DocumentErrors';
import { assertDraftOwner, assertRecordMatchesScope, parseDraftToken, parseIdentifier } from '../DocumentScope';

describe('DocumentScope', () => {
  it('extracts identifiers and accepts only bounded draft tokens', () => {
    expect(parseIdentifier({ value: { id: 42 } })).toBe('42');
    expect(parseDraftToken('valid_draft-token-1234')).toBe('valid_draft-token-1234');
    expect(parseDraftToken('../invalid')).toBeNull();
  });

  it('rejects a record from another process', () => {
    expect(() =>
      assertRecordMatchesScope({ processId: '2', draftToken: null }, { mode: 'process', processId: '1' }),
    ).toThrowError(ProcessDocumentsError);
  });

  it('allows only the draft owner or root', () => {
    const record = { processId: null, draftToken: 'valid_draft-token-1234', createdById: '7' };
    const scope = { mode: 'draft', draftToken: 'valid_draft-token-1234' } as const;
    expect(() => assertDraftOwner(record, scope, { userId: '7', isRoot: false })).not.toThrow();
    expect(() => assertDraftOwner(record, scope, { userId: '8', isRoot: false })).toThrowError(
      'Нет прав для действия с черновыми документами процесса.',
    );
  });
});
