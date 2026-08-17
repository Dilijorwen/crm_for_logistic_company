/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export interface UnreadChatsCountSnapshot {
  unreadCount: number;
  error: unknown;
}

type SnapshotListener = () => void;
type LoadUnreadCount = () => Promise<number>;
type AttachPolling = (refresh: () => void) => () => void;

export class UnreadChatsCountStore {
  private snapshot: UnreadChatsCountSnapshot = {
    unreadCount: 0,
    error: null,
  };
  private readonly listeners = new Set<SnapshotListener>();
  private stopPolling: (() => void) | undefined;
  private pendingRefresh: Promise<boolean> | undefined;
  private generation = 0;

  constructor(
    private readonly loadUnreadCount: LoadUnreadCount,
    private readonly attachPolling: AttachPolling,
  ) {}

  readonly getSnapshot = (): UnreadChatsCountSnapshot => this.snapshot;

  readonly subscribe = (listener: SnapshotListener): (() => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      this.startPolling();
    }

    return () => {
      if (!this.listeners.delete(listener) || this.listeners.size > 0) {
        return;
      }
      this.stopPollingAndInvalidateRequests();
    };
  };

  readonly refresh = (): Promise<boolean> => {
    if (this.pendingRefresh) {
      return this.pendingRefresh;
    }

    const requestGeneration = this.generation;
    const request = this.loadUnreadCount()
      .then(
        (unreadCount) => {
          if (requestGeneration === this.generation) {
            this.setSnapshot({ unreadCount, error: null });
          }
          return true;
        },
        (error: unknown) => {
          if (requestGeneration === this.generation) {
            this.setSnapshot({ unreadCount: this.snapshot.unreadCount, error });
          }
          return false;
        },
      )
      .finally(() => {
        if (this.pendingRefresh === request) {
          this.pendingRefresh = undefined;
        }
      });

    this.pendingRefresh = request;
    return request;
  };

  private readonly runRefresh = (): void => {
    this.refresh();
  };

  private startPolling(): void {
    this.generation += 1;
    this.stopPolling = this.attachPolling(this.runRefresh);
    this.runRefresh();
  }

  private stopPollingAndInvalidateRequests(): void {
    this.generation += 1;
    this.stopPolling?.();
    this.stopPolling = undefined;
    this.pendingRefresh = undefined;
  }

  private setSnapshot(nextSnapshot: UnreadChatsCountSnapshot): void {
    if (this.snapshot.unreadCount === nextSnapshot.unreadCount && this.snapshot.error === nextSnapshot.error) {
      return;
    }
    this.snapshot = nextSnapshot;
    this.listeners.forEach((listener) => listener());
  }
}
