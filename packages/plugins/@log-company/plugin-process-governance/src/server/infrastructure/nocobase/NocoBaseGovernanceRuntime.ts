import type { Plugin } from '@nocobase/server';
import type { GovernanceLogger } from '../../application/ports/ProcessGovernanceRepository';

const PROCESS_COLLECTION = 'customs_processes';
const HISTORY_COLLECTION = 'process_history';
const PROCESS_NUMBER_FIELD = 'process_number';

export class NocoBaseGovernanceRuntime {
  constructor(
    private readonly plugin: Plugin,
    private readonly logger: GovernanceLogger,
  ) {}

  configure(): void {
    this.ensureProcessNumberField();
    this.ensureHistoryRelation();
  }

  private ensureProcessNumberField(): void {
    const processCollection = this.plugin.db.getCollection(PROCESS_COLLECTION);
    if (!processCollection || processCollection.hasField?.(PROCESS_NUMBER_FIELD)) {
      return;
    }
    try {
      processCollection.setField(PROCESS_NUMBER_FIELD, {
        type: 'integer',
        name: PROCESS_NUMBER_FIELD,
        interface: 'integer',
        uiSchema: {
          type: 'number',
          title: 'Порядковый номер',
          'x-component': 'InputNumber',
          'x-read-pretty': true,
        },
      });
    } catch (error) {
      this.logger.error('Не удалось зарегистрировать runtime-поле customs_processes.process_number', error);
    }
  }

  private ensureHistoryRelation(): void {
    const historyCollection = this.plugin.db.getCollection(HISTORY_COLLECTION);
    const processCollection = this.plugin.db.getCollection(PROCESS_COLLECTION);
    if (!historyCollection || !processCollection || historyCollection.hasField?.('process')) {
      return;
    }
    try {
      historyCollection.setField('process', {
        type: 'belongsTo',
        name: 'process',
        interface: 'm2o',
        target: PROCESS_COLLECTION,
        foreignKey: 'process_id',
        onDelete: 'RESTRICT',
        allowNull: false,
        uiSchema: {
          type: 'object',
          title: 'Процесс',
          'x-component': 'AssociationField',
          'x-component-props': { fieldNames: { value: 'id', label: 'title' } },
          required: true,
        },
      });
    } catch (error) {
      this.logger.error('Не удалось зарегистрировать runtime-связь process_history.process', error);
    }
  }
}
