import { describe, expect, it } from 'vitest';
import { buildProcessTitle } from '../ProcessTitle';

describe('buildProcessTitle', () => {
  it('builds a complete process title', () => {
    expect(buildProcessTitle({ processNumber: 12, carNumber: 'A123BC', clientName: 'Shanghai Cargo' })).toEqual({
      title: '12 - A123BC с Shanghai Cargo',
      isIncomplete: false,
    });
  });

  it('uses explicit fallbacks for incomplete data', () => {
    expect(buildProcessTitle({ processNumber: null, carNumber: ' ', clientName: null })).toEqual({
      title: 'Без номера процесса - Без номера с Без клиента',
      isIncomplete: true,
    });
  });
});
