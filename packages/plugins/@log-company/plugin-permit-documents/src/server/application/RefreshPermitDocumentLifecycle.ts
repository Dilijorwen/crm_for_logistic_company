/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { permitDocumentToday, voluntaryDocumentStatus } from '../domain/permit-document/PermitDocumentCategoryPolicy';
import type { SyncClock } from './ports/PermitDocumentSyncSupport';

export interface PermitDocumentLifecycleRepository {
  listLocalPeriods(): Promise<Array<{ id: string; category: 'rented' | 'voluntary'; until: string }>>;
  applyLocalState(id: string, category: 'rented' | 'voluntary', until: string, state: string): Promise<void>;
}

export class RefreshPermitDocumentLifecycle {
  constructor(
    private readonly repository: PermitDocumentLifecycleRepository,
    private readonly clock: SyncClock,
  ) {}
  async execute(): Promise<void> {
    const today = permitDocumentToday(this.clock.now());
    for (const document of await this.repository.listLocalPeriods()) {
      const state =
        document.category === 'voluntary'
          ? voluntaryDocumentStatus(document.until, today)
          : document.until < today
            ? 'expired'
            : 'active';
      await this.repository.applyLocalState(document.id, document.category, document.until, state);
    }
  }
}
