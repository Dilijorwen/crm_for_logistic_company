import type { Plugin } from '@nocobase/server';
import { AssignProcessNumber } from '../../application/AssignProcessNumber';
import { BuildComputedProcessTitle } from '../../application/BuildComputedProcessTitle';
import { CaptureProcessSnapshot } from '../../application/CaptureProcessSnapshot';
import { RecordParentChange } from '../../application/RecordParentChange';
import { RecordProcessCreated } from '../../application/RecordProcessCreated';
import { RecordProcessFieldChanges } from '../../application/RecordProcessFieldChanges';
import { RefreshChineseClientProcessTitles } from '../../application/RefreshChineseClientProcessTitles';
import { ValidateProcessParents } from '../../application/ValidateProcessParents';
import type {
  GovernanceTransaction,
  ProcessGovernanceRepository,
  ProcessValuesSnapshot,
} from '../../application/ports/ProcessGovernanceRepository';
import { ProcessGovernanceError } from '../../domain/process/ProcessGovernanceError';
import { extractIdentifier, sameIdentifier, type EntityId } from '../../domain/shared/Identifiers';

const PROCESS_COLLECTION = 'customs_processes';
const CLIENT_COLLECTION = 'chinese_clients';
const HISTORY_COLLECTION = 'process_history';
const PARENT_LINKS_COLLECTION = 'customs_process_parent_links';
const PROCESS_NUMBER_FIELD = 'process_number';

interface NocoBaseModel {
  isNewRecord?: boolean;
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  previous?(key: string): unknown;
  changed?(): unknown;
}

interface HookOptions {
  transaction?: GovernanceTransaction;
  context?: unknown;
  inputValues?: unknown;
  values?: unknown;
  fields?: string[];
  processGovernanceInternal?: boolean;
}

export interface ProcessGovernanceHookActions {
  assignProcessNumber: AssignProcessNumber;
  buildComputedTitle: BuildComputedProcessTitle;
  captureSnapshot: CaptureProcessSnapshot;
  recordCreated: RecordProcessCreated;
  recordFieldChanges: RecordProcessFieldChanges;
  recordParentChange: RecordParentChange;
  refreshClientTitles: RefreshChineseClientProcessTitles;
  validateParents: ValidateProcessParents;
}

export class ProcessGovernanceHooks {
  constructor(
    private readonly plugin: Plugin,
    private readonly repository: ProcessGovernanceRepository,
    private readonly actions: ProcessGovernanceHookActions,
  ) {}

  register(): void {
    this.registerProcessHooks();
    this.registerClientHooks();
    this.registerParentLinkHooks();
    this.registerHistoryGuards();
  }

  private registerProcessHooks(): void {
    this.plugin.db.on(`${PROCESS_COLLECTION}.beforeCreate`, async (model: NocoBaseModel, options: HookOptions) => {
      await this.prepareProcess(model, options);
    });
    this.plugin.db.on(`${PROCESS_COLLECTION}.beforeUpdate`, async (model: NocoBaseModel, options: HookOptions) => {
      const processId = extractIdentifier(model.get('id'));
      if (processId !== null) {
        await this.actions.captureSnapshot.execute({
          processId,
          transaction: options.transaction,
          snapshotScope: options.transaction ?? options.context,
          fallbackSnapshot: this.previousSnapshot(model),
        });
      }
      await this.prepareProcess(model, options);
    });
    this.plugin.db.on(
      `${PROCESS_COLLECTION}.afterCreateWithAssociations`,
      async (model: NocoBaseModel, options: HookOptions) => {
        const processId = this.requiredIdentifier(model.get('id'));
        await this.actions.recordCreated.execute({
          processId,
          title: String(model.get('title') || ''),
          transaction: options.transaction,
          context: options.context,
        });
      },
    );
    this.plugin.db.on(
      `${PROCESS_COLLECTION}.afterUpdateWithAssociations`,
      async (model: NocoBaseModel, options: HookOptions) => {
        await this.actions.recordFieldChanges.execute({
          processId: this.requiredIdentifier(model.get('id')),
          transaction: options.transaction,
          snapshotScope: options.transaction ?? options.context,
          context: options.context,
        });
      },
    );
    this.plugin.db.on(`${PROCESS_COLLECTION}.afterDestroy`, async (_model: NocoBaseModel, options: HookOptions) => {
      await this.repository.rebalanceProcessNumbers(options.transaction);
    });
  }

  private registerClientHooks(): void {
    this.plugin.db.on(`${CLIENT_COLLECTION}.afterUpdate`, async (model: NocoBaseModel, options: HookOptions) => {
      const changed = model.changed?.();
      const changedFields = Array.isArray(changed) ? changed.map(String) : options.fields || [];
      const previousName = model.previous?.('name');
      const currentName = model.get('name');
      if (!changedFields.includes('name') && previousName === currentName) {
        return;
      }
      await this.actions.refreshClientTitles.execute({
        clientId: extractIdentifier(model.get('id')),
        clientName: currentName,
        transaction: options.transaction,
      });
    });
  }

  private registerParentLinkHooks(): void {
    this.plugin.db.on(`${PARENT_LINKS_COLLECTION}.beforeCreate`, async (model: NocoBaseModel, options: HookOptions) => {
      await this.validateParentLink(model, options);
    });
    this.plugin.db.on(`${PARENT_LINKS_COLLECTION}.beforeUpdate`, async (model: NocoBaseModel, options: HookOptions) => {
      await this.validateParentLink(model, options);
    });
    this.plugin.db.on(`${PARENT_LINKS_COLLECTION}.afterCreate`, async (model: NocoBaseModel, options: HookOptions) => {
      await this.recordParentLink(
        'parent_added',
        model.get('child_process_id'),
        model.get('parent_process_id'),
        options,
      );
    });
    this.plugin.db.on(`${PARENT_LINKS_COLLECTION}.afterDestroy`, async (model: NocoBaseModel, options: HookOptions) => {
      await this.recordParentLink(
        'parent_removed',
        model.get('child_process_id'),
        model.get('parent_process_id'),
        options,
      );
    });
    this.plugin.db.on(`${PARENT_LINKS_COLLECTION}.afterUpdate`, async (model: NocoBaseModel, options: HookOptions) => {
      const oldChildId = model.previous?.('child_process_id');
      const oldParentId = model.previous?.('parent_process_id');
      const newChildId = model.get('child_process_id');
      const newParentId = model.get('parent_process_id');
      if (!sameIdentifier(oldChildId, newChildId) || !sameIdentifier(oldParentId, newParentId)) {
        await this.recordParentLink('parent_removed', oldChildId, oldParentId, options);
        await this.recordParentLink('parent_added', newChildId, newParentId, options);
      }
    });
  }

  private registerHistoryGuards(): void {
    this.plugin.db.on(`${HISTORY_COLLECTION}.beforeCreate`, async (_model: NocoBaseModel, options: HookOptions) => {
      if (!options.processGovernanceInternal) {
        throw this.httpError(403, 'История процессов создается автоматически и недоступна для ручного изменения.');
      }
    });
    this.plugin.db.on(`${HISTORY_COLLECTION}.beforeUpdate`, async () => {
      throw this.httpError(403, 'История процессов неизменяема.');
    });
    this.plugin.db.on(`${HISTORY_COLLECTION}.beforeDestroy`, async () => {
      throw this.httpError(403, 'История процессов неизменяема.');
    });
  }

  private async prepareProcess(model: NocoBaseModel, options: HookOptions): Promise<void> {
    const rawValues = this.asRecord(options.inputValues ?? options.values);
    const processNumber = await this.actions.assignProcessNumber.execute({
      isNewRecord: Boolean(model.isNewRecord),
      previousNumber: model.previous?.(PROCESS_NUMBER_FIELD),
      currentNumber: model.get(PROCESS_NUMBER_FIELD),
      transaction: options.transaction,
    });
    model.set(PROCESS_NUMBER_FIELD, processNumber);

    const clientId = Object.prototype.hasOwnProperty.call(rawValues, 'chinese_client')
      ? extractIdentifier(rawValues.chinese_client)
      : Object.prototype.hasOwnProperty.call(rawValues, 'chinese_client_id')
        ? extractIdentifier(rawValues.chinese_client_id)
        : extractIdentifier(model.get('chinese_client_id'));
    const carNumber = Object.prototype.hasOwnProperty.call(rawValues, 'car_number')
      ? rawValues.car_number
      : model.get('car_number');
    model.set(
      'title',
      await this.actions.buildComputedTitle.execute({
        processId: extractIdentifier(model.get('id')),
        processNumber,
        carNumber,
        chineseClientId: clientId,
        transaction: options.transaction,
      }),
    );
  }

  private previousSnapshot(model: NocoBaseModel): ProcessValuesSnapshot {
    const snapshot: ProcessValuesSnapshot = {};
    for (const field of this.repository.getTrackedFields()) {
      snapshot[field.name] = model.previous?.(field.storageKey);
    }
    return snapshot;
  }

  private async validateParentLink(model: NocoBaseModel, options: HookOptions): Promise<void> {
    try {
      await this.actions.validateParents.execute({
        processId: extractIdentifier(model.get('child_process_id')),
        parentIds: this.optionalIdentifiers(model.get('parent_process_id')),
        transaction: options.transaction,
      });
    } catch (error) {
      if (error instanceof ProcessGovernanceError) {
        throw this.httpError(400, error.message);
      }
      throw error;
    }
  }

  private async recordParentLink(
    eventType: 'parent_added' | 'parent_removed',
    processIdValue: unknown,
    parentIdValue: unknown,
    options: HookOptions,
  ): Promise<void> {
    const processId = extractIdentifier(processIdValue);
    const parentProcessId = extractIdentifier(parentIdValue);
    if (processId === null || parentProcessId === null) {
      return;
    }
    await this.actions.recordParentChange.execute({
      eventType,
      processId,
      parentProcessId,
      transaction: options.transaction,
      context: options.context,
    });
  }

  private requiredIdentifier(value: unknown): EntityId {
    const identifier = extractIdentifier(value);
    if (identifier === null) {
      throw new Error('Идентификатор процесса отсутствует.');
    }
    return identifier;
  }

  private optionalIdentifiers(value: unknown): EntityId[] {
    const identifier = extractIdentifier(value);
    return identifier === null ? [] : [identifier];
  }

  private httpError(status: number, message: string): Error {
    return Object.assign(new Error(message), { status, statusCode: status });
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
