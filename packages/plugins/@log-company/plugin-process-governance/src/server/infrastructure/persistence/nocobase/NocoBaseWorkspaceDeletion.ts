/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createUserProvider, parseJsonTemplate } from '@nocobase/acl';
import type { Context } from '@nocobase/actions';
import type { Database, Transaction, Model, MultipleRelationRepository } from '@nocobase/database';
import { QueryTypes } from 'sequelize';
import {
  WorkspaceDeletionError,
  type WorkspaceDeletionSession,
  type WorkspaceDeletionSelection,
  type WorkspaceDeletionUnitOfWork,
} from '../../../application/logistics/DeleteWorkspaceShipments';

interface Permission {
  params?: { filter?: Record<string, unknown> };
}
type AuthorizedContext = Context & { can?: (request: { resource: string; action: string }) => Permission | null };

class DeletionSession implements WorkspaceDeletionSession {
  constructor(
    private readonly db: Database,
    private readonly context: AuthorizedContext,
    private readonly transaction: Transaction,
  ) {}

  async select(rowIds: string[]): Promise<WorkspaceDeletionSelection> {
    const rows = await this.db.getRepository('logistics_work_items').find({
      filter: { id: { $in: rowIds } },
      fields: ['id'],
      transaction: this.transaction,
    });
    if (rows.length !== rowIds.length)
      throw new WorkspaceDeletionError(
        'NOT_FOUND',
        'Часть выбранных поставок уже удалена или отвязана. Обновите список.',
      );
    const shipmentIds = Array.from(new Set(rowIds.map((id) => id.split(':')[1]))).sort();
    await this.lockRecords('shipments', shipmentIds);
    const links = await this.db.getRepository('transport_run_shipments').find({
      filter: { shipment_id: { $in: shipmentIds } },
      transaction: this.transaction,
    });
    const runIds = Array.from(new Set<string>(links.map((link: Model) => String(link.get('transport_run_id'))))).sort();
    await this.lockRecords('transport_runs', runIds);
    for (const runId of runIds) await this.assertPermission('transport_runs', 'list', runId);
    return { shipmentIds, runIds };
  }

  private async lockRecords(collection: 'transport_runs' | 'shipments', ids: string[]): Promise<void> {
    if (!ids.length) return;
    const rows = await this.db.getCollection(collection).model.findAll({
      where: { id: ids },
      attributes: ['id'],
      order: [['id', 'ASC']],
      transaction: this.transaction,
      lock: this.transaction.LOCK.UPDATE,
    });
    if (rows.length !== ids.length)
      throw new WorkspaceDeletionError('NOT_FOUND', 'Часть выбранных записей уже удалена. Обновите список.');
  }

  private async assertPermission(resource: string, action: string, id: string): Promise<void> {
    const permission = this.context.can?.({ resource, action });
    if (!permission)
      throw new WorkspaceDeletionError(
        'FORBIDDEN',
        action === 'destroy' && resource === 'transport_runs'
          ? 'Нет прав на удаление рейса, который останется без поставок. Удаление отменено.'
          : 'Нет прав для удаления выбранных поставок или доступа к их рейсам.',
      );
    const rawFilter = permission.params?.filter;
    const filter = rawFilter
      ? await parseJsonTemplate(rawFilter, {
          state: this.context.state,
          timezone: this.context.get('x-timezone'),
          userProvider: createUserProvider({ db: this.db, currentUser: this.context.state.currentUser }),
        })
      : undefined;
    const row = await this.db
      .getRepository(resource)
      .findOne({ filterByTk: id, filter, transaction: this.transaction });
    if (!row) throw new WorkspaceDeletionError('FORBIDDEN', 'Выбранная запись недоступна для этого действия.');
  }

  async assertShipmentDeletion(id: string): Promise<void> {
    await this.assertPermission('shipments', 'destroy', id);
  }
  async assertRunDeletion(id: string): Promise<void> {
    await this.assertPermission('transport_runs', 'destroy', id);
  }

  async findRunsEmptiedBy(selection: WorkspaceDeletionSelection): Promise<string[]> {
    if (!selection.runIds.length) return [];
    const rows = await this.db.sequelize.query<{ id: string }>(
      'SELECT CAST(run.id AS TEXT) AS id FROM transport_runs run WHERE run.id IN (:runIds) AND NOT EXISTS (SELECT 1 FROM transport_run_shipments link WHERE link.transport_run_id = run.id AND link.shipment_id NOT IN (:shipmentIds)) ORDER BY run.id',
      { replacements: { ...selection }, type: QueryTypes.SELECT, transaction: this.transaction },
    );
    return rows.map((row) => row.id);
  }

  async detachShipments(selection: WorkspaceDeletionSelection): Promise<void> {
    for (const runId of selection.runIds) {
      await this.db.getRepository<MultipleRelationRepository>('transport_runs.shipments', runId).remove({
        tk: selection.shipmentIds,
        transaction: this.transaction,
        context: this.context,
      });
    }
  }

  async destroyShipments(ids: string[]): Promise<void> {
    await this.db
      .getRepository('shipments')
      .destroy({ filter: { id: { $in: ids } }, transaction: this.transaction, context: this.context });
  }
  async destroyRuns(ids: string[]): Promise<void> {
    await this.db
      .getRepository('transport_runs')
      .destroy({ filter: { id: { $in: ids } }, transaction: this.transaction, context: this.context });
  }
}

export class NocoBaseWorkspaceDeletion implements WorkspaceDeletionUnitOfWork {
  constructor(
    private readonly db: Database,
    private readonly context: AuthorizedContext,
  ) {}
  async run<T>(work: (session: WorkspaceDeletionSession) => Promise<T>): Promise<T> {
    return this.db.sequelize.transaction((transaction) =>
      work(new DeletionSession(this.db, this.context, transaction)),
    );
  }
}
