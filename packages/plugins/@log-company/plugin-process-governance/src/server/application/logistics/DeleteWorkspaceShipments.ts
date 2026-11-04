/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export class WorkspaceDeletionError extends Error {
  constructor(
    public readonly code: 'INVALID_SELECTION' | 'FORBIDDEN' | 'NOT_FOUND',
    message: string,
  ) {
    super(message);
  }
}

export interface WorkspaceDeletionSelection {
  shipmentIds: string[];
  runIds: string[];
}
export interface WorkspaceDeletionSession {
  select(rowIds: string[]): Promise<WorkspaceDeletionSelection>;
  assertShipmentDeletion(shipmentId: string): Promise<void>;
  assertRunDeletion(runId: string): Promise<void>;
  findRunsEmptiedBy(selection: WorkspaceDeletionSelection): Promise<string[]>;
  detachShipments(selection: WorkspaceDeletionSelection): Promise<void>;
  destroyShipments(ids: string[]): Promise<void>;
  destroyRuns(ids: string[]): Promise<void>;
}
export interface WorkspaceDeletionUnitOfWork {
  run<T>(work: (session: WorkspaceDeletionSession) => Promise<T>): Promise<T>;
}

/** One shipment may have several selected rows and may be carried in several runs. */
export class DeleteWorkspaceShipments {
  constructor(private readonly unitOfWork: WorkspaceDeletionUnitOfWork) {}

  async execute(value: unknown): Promise<{ shipments: number; runs: number; shipmentIds: string[]; runIds: string[] }> {
    if (
      !Array.isArray(value) ||
      !value.length ||
      value.length > 200 ||
      value.some((id) => typeof id !== 'string' || !/^[1-9]\d*:[1-9]\d*$/.test(id))
    ) {
      throw new WorkspaceDeletionError('INVALID_SELECTION', 'Выберите от 1 до 200 строк с поставками.');
    }
    const rowIds = Array.from(new Set<string>(value));
    return this.unitOfWork.run(async (session) => {
      const selection = await session.select(rowIds);
      for (const id of selection.shipmentIds) await session.assertShipmentDeletion(id);
      const emptyRunIds = await session.findRunsEmptiedBy(selection);
      for (const id of emptyRunIds) await session.assertRunDeletion(id);
      await session.detachShipments(selection);
      await session.destroyShipments(selection.shipmentIds);
      if (emptyRunIds.length) await session.destroyRuns(emptyRunIds);
      return {
        shipments: selection.shipmentIds.length,
        runs: emptyRunIds.length,
        shipmentIds: selection.shipmentIds,
        runIds: emptyRunIds,
      };
    });
  }
}
