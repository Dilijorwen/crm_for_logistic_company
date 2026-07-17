import { describe, expect, it } from 'vitest';
import { ProcessSnapshotStore } from '../ProcessSnapshotStore';

describe('ProcessSnapshotStore', () => {
  it('isolates concurrent snapshots of the same process by operation scope', () => {
    const store = new ProcessSnapshotStore();
    const firstOperation = {};
    const secondOperation = {};

    store.save(10, { status: 'before-first' }, firstOperation);
    store.save(10, { status: 'before-second' }, secondOperation);

    expect(store.take(10, firstOperation)).toEqual({ status: 'before-first' });
    expect(store.take(10, secondOperation)).toEqual({ status: 'before-second' });
  });

  it('removes a snapshot after it is consumed', () => {
    const store = new ProcessSnapshotStore();
    const operation = {};
    store.save('process-1', { title: 'До изменения' }, operation);

    expect(store.take('process-1', operation)).toEqual({ title: 'До изменения' });
    expect(store.take('process-1', operation)).toBeNull();
  });
});
