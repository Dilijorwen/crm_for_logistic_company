import type { Plugin } from '@nocobase/server';
import type { CreateOptions, Transaction } from '@nocobase/database';
import type { ProcessHistoryEntry } from '../../../domain/history/ProcessHistory';
import { formatPlainHistoryValue } from '../../../domain/history/ProcessHistory';
import { normalizeText, type EntityId } from '../../../domain/shared/Identifiers';
import type {
  GovernanceTransaction,
  ProcessCoreData,
  ProcessGovernanceRepository,
  ProcessValuesSnapshot,
  TrackedProcessField,
} from '../../../application/ports/ProcessGovernanceRepository';

const PROCESS_COLLECTION = 'customs_processes';
const CLIENT_COLLECTION = 'chinese_clients';
const HISTORY_COLLECTION = 'process_history';
const PARENT_LINKS_COLLECTION = 'customs_process_parent_links';
const GRAPH_LOCK_KEY = 'log-company-process-parent-graph';
const PROCESS_NUMBER_LOCK_KEY = 'log-company-process-numbering';
const PROCESS_NUMBER_FIELD = 'process_number';

const SYSTEM_FIELDS = new Set([
  'id',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
  'createdById',
  'updatedById',
  'title',
  PROCESS_NUMBER_FIELD,
]);

const EXCLUDED_ASSOCIATION_FIELDS = new Set(['parent_processes', 'child_processes', 'comments', 'documents']);

interface EnumOptionMetadata {
  value?: unknown;
  label?: unknown;
}

interface ProcessGovernanceCreateOptions extends CreateOptions {
  processGovernanceInternal: true;
}

export class NocoBaseProcessGovernanceRepository implements ProcessGovernanceRepository {
  constructor(private readonly plugin: Plugin) {}

  async lockParentGraph(transaction?: GovernanceTransaction): Promise<void> {
    if (!transaction || this.plugin.db.sequelize.getDialect() !== 'postgres') {
      return;
    }
    await this.plugin.db.sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:key))', {
      replacements: { key: GRAPH_LOCK_KEY },
      transaction: this.asTransaction(transaction),
    });
  }

  async getParentIds(processId: EntityId, transaction?: GovernanceTransaction): Promise<EntityId[]> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `select parent_process_id from ${PARENT_LINKS_COLLECTION} where child_process_id = :processId`,
      { replacements: { processId }, transaction: this.asTransaction(transaction) },
    )) as [Array<{ parent_process_id: EntityId }>, unknown];
    return rows.map((row) => row.parent_process_id);
  }

  async parentSelectionCreatesCycle(
    processId: EntityId,
    parentIds: EntityId[],
    transaction?: GovernanceTransaction,
  ): Promise<boolean> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `
        with recursive descendants(id) as (
          select child_process_id
          from ${PARENT_LINKS_COLLECTION}
          where parent_process_id = :processId
          union
          select link.child_process_id
          from ${PARENT_LINKS_COLLECTION} link
          inner join descendants on descendants.id = link.parent_process_id
        )
        select id from descendants where id in (:parentIds) limit 1
      `,
      {
        replacements: { processId, parentIds },
        transaction: this.asTransaction(transaction),
      },
    )) as [Array<{ id: EntityId }>, unknown];
    return rows.length > 0;
  }

  async nextProcessNumber(transaction?: GovernanceTransaction): Promise<number> {
    await this.lockProcessNumbers(transaction);
    await this.rebalanceProcessNumbers(transaction);
    const [rows] = (await this.plugin.db.sequelize.query(`select count(*) + 1 as value from ${PROCESS_COLLECTION}`, {
      transaction: this.asTransaction(transaction),
    })) as [Array<{ value: string | number }>, unknown];
    return Number(rows[0]?.value || 1);
  }

  async rebalanceProcessNumbers(transaction?: GovernanceTransaction): Promise<void> {
    await this.lockProcessNumbers(transaction);
    await this.plugin.db.sequelize.query(
      `
        with numbered as (
          select
            cp.id,
            row_number() over (order by cp."createdAt" asc nulls last, cp.id asc)::integer as process_number,
            coalesce(nullif(btrim(cp.car_number), ''), 'Без номера') as car_number,
            coalesce(nullif(btrim(cc.name), ''), 'Без клиента') as client_name
          from ${PROCESS_COLLECTION} cp
          left join ${CLIENT_COLLECTION} cc on cc.id = cp.chinese_client_id
        ),
        desired as (
          select id, process_number, concat(process_number::text, ' - ', car_number, ' с ', client_name) as title
          from numbered
        )
        update ${PROCESS_COLLECTION} cp
        set process_number = desired.process_number, title = desired.title
        from desired
        where cp.id = desired.id
          and (cp.process_number is distinct from desired.process_number or cp.title is distinct from desired.title)
      `,
      { transaction: this.asTransaction(transaction) },
    );
  }

  async findChineseClientName(clientId: EntityId, transaction?: GovernanceTransaction): Promise<string> {
    const client = await this.plugin.db.getRepository(CLIENT_COLLECTION).findOne({
      filter: { id: clientId },
      transaction: this.asTransaction(transaction),
    });
    return normalizeText(client?.get('name'));
  }

  async refreshTitlesForChineseClient(
    clientId: EntityId,
    clientName: string,
    transaction?: GovernanceTransaction,
  ): Promise<void> {
    await this.plugin.db.sequelize.query(
      `
        update ${PROCESS_COLLECTION}
        set title = concat(
          coalesce(process_number::text, 'Без номера процесса'), ' - ',
          coalesce(nullif(btrim(car_number), ''), 'Без номера'), ' с ', :clientName
        )
        where chinese_client_id = :clientId
          and title is distinct from concat(
            coalesce(process_number::text, 'Без номера процесса'), ' - ',
            coalesce(nullif(btrim(car_number), ''), 'Без номера'), ' с ', :clientName
          )
      `,
      {
        replacements: { clientId, clientName },
        transaction: this.asTransaction(transaction),
      },
    );
  }

  async findProcess(processId: EntityId, transaction?: GovernanceTransaction): Promise<ProcessCoreData | null> {
    const process = await this.plugin.db.getRepository(PROCESS_COLLECTION).findOne({
      filter: { id: processId },
      transaction: this.asTransaction(transaction),
    });
    if (!process) {
      return null;
    }
    const id = process.get('id');
    return {
      id: String(id),
      title: normalizeText(process.get('title')),
      processNumber: process.get(PROCESS_NUMBER_FIELD),
      carNumber: process.get('car_number'),
      chineseClientId: (process.get('chinese_client_id') as EntityId | null) ?? null,
    };
  }

  getTrackedFields(): TrackedProcessField[] {
    const collection = this.plugin.db.getCollection(PROCESS_COLLECTION);
    if (!collection) {
      return [];
    }
    return collection
      .getFields()
      .filter((field) => this.isTrackedBusinessField(field))
      .map((field) => {
        const options = field.options;
        const enumOptions = Array.isArray(options?.uiSchema?.enum)
          ? options.uiSchema.enum.map((item: EnumOptionMetadata) => ({
              value: item.value,
              label: String(item.label ?? item.value ?? ''),
            }))
          : undefined;
        return {
          name: options.name,
          label: options?.uiSchema?.title || options.name,
          storageKey: field.type === 'belongsTo' ? options.foreignKey : options.name,
          kind: field.type === 'belongsTo' ? 'belongsTo' : 'scalar',
          targetCollection: options.target,
          targetKey: options.targetKey || 'id',
          enumOptions,
        } as TrackedProcessField;
      });
  }

  async findProcessValues(
    processId: EntityId,
    fields: TrackedProcessField[],
    transaction?: GovernanceTransaction,
  ): Promise<ProcessValuesSnapshot | null> {
    const process = await this.plugin.db.getRepository(PROCESS_COLLECTION).findOne({
      filter: { id: processId },
      transaction: this.asTransaction(transaction),
    });
    if (!process) {
      return null;
    }
    const snapshot: ProcessValuesSnapshot = {};
    for (const field of fields) {
      snapshot[field.name] = process.get(field.storageKey);
    }
    return snapshot;
  }

  async getRecordLabel(
    collectionName: string,
    id: EntityId,
    targetKey: string,
    transaction?: GovernanceTransaction,
  ): Promise<string> {
    const collection = this.plugin.db.getCollection(collectionName);
    const record = await this.plugin.db.getRepository(collectionName).findOne({
      filter: { [targetKey]: id },
      transaction: this.asTransaction(transaction),
    });
    if (!record) {
      return String(id);
    }
    if (collectionName === CLIENT_COLLECTION) {
      return formatPlainHistoryValue(record.get('name') || id);
    }
    if (collectionName === 'users') {
      return formatPlainHistoryValue(record.get('nickname') || record.get('username') || id);
    }
    const titleField = collection?.options?.titleField || 'title';
    return formatPlainHistoryValue(record.get(titleField) || record.get('name') || record.get('title') || id);
  }

  historyCollectionExists(): boolean {
    return Boolean(this.plugin.db.getCollection(HISTORY_COLLECTION));
  }

  async createHistory(
    entry: ProcessHistoryEntry,
    transaction?: GovernanceTransaction,
    context?: unknown,
  ): Promise<void> {
    const options: ProcessGovernanceCreateOptions = {
      values: {
        process_id: entry.processId,
        event_type: entry.eventType,
        field_name: entry.fieldName,
        field_label: entry.fieldLabel,
        old_value: entry.oldValue,
        new_value: entry.newValue,
      },
      transaction: this.asTransaction(transaction),
      context,
      processGovernanceInternal: true,
    };
    await this.plugin.db.getRepository(HISTORY_COLLECTION).create(options);
  }

  private async lockProcessNumbers(transaction?: GovernanceTransaction): Promise<void> {
    if (!transaction || this.plugin.db.sequelize.getDialect() !== 'postgres') {
      return;
    }
    await this.plugin.db.sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:key))', {
      replacements: { key: PROCESS_NUMBER_LOCK_KEY },
      transaction: this.asTransaction(transaction),
    });
  }

  private isTrackedBusinessField(field: { type: string; options?: Record<string, unknown> }): boolean {
    const options = field.options || {};
    const name = typeof options.name === 'string' ? options.name : '';
    if (!name || SYSTEM_FIELDS.has(name) || EXCLUDED_ASSOCIATION_FIELDS.has(name)) {
      return false;
    }
    if (options.isForeignKey) {
      return false;
    }
    return !['hasMany', 'belongsToMany'].includes(field.type);
  }

  private asTransaction(transaction?: GovernanceTransaction): Transaction | undefined {
    return transaction as Transaction | undefined;
  }
}
