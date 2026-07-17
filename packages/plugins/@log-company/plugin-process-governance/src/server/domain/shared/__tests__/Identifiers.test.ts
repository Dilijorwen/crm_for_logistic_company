import { describe, expect, it } from 'vitest';
import { extractIdentifier, normalizeIdentifiers, uniqueIdentifiers } from '../Identifiers';

describe('process identifiers', () => {
  it('extracts identifiers from stable API representations', () => {
    expect(extractIdentifier({ value: { id: 15 } })).toBe(15);
    expect(normalizeIdentifiers([{ id: 1 }, { id: 1 }, { value: 2 }])).toEqual([1, 2]);
  });

  it('removes empty and duplicate identifiers', () => {
    expect(uniqueIdentifiers([null, '', 1, '1', 2])).toEqual([1, 2]);
  });
});
