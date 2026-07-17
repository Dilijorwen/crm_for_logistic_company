import { buildProcessTitle } from '../domain/process/ProcessTitle';
import { normalizeText, type EntityId } from '../domain/shared/Identifiers';
import type {
  GovernanceLogger,
  GovernanceTransaction,
  ProcessGovernanceRepository,
} from './ports/ProcessGovernanceRepository';

export interface BuildComputedProcessTitleInput {
  processId?: EntityId | null;
  processNumber: unknown;
  carNumber: unknown;
  chineseClientId: EntityId | null;
  transaction?: GovernanceTransaction;
}

export class BuildComputedProcessTitle {
  constructor(
    private readonly repository: ProcessGovernanceRepository,
    private readonly logger: GovernanceLogger,
  ) {}

  async execute(input: BuildComputedProcessTitleInput): Promise<string> {
    let clientName = '';
    if (input.chineseClientId !== null) {
      try {
        clientName = await this.repository.findChineseClientName(input.chineseClientId, input.transaction);
      } catch (error) {
        this.logger.error('Не удалось получить имя китайского клиента для названия процесса', error, {
          processId: input.processId === null ? undefined : String(input.processId),
          chineseClientId: String(input.chineseClientId),
        });
      }
    }

    const result = buildProcessTitle({
      processNumber: input.processNumber,
      carNumber: input.carNumber,
      clientName,
    });
    if (result.isIncomplete) {
      this.logger.warn('Название процесса создано с временным значением из-за неполных данных', {
        processId: input.processId === null ? undefined : String(input.processId),
        hasProcessNumber: Boolean(normalizeText(input.processNumber)),
        hasCarNumber: Boolean(normalizeText(input.carNumber)),
        chineseClientId: input.chineseClientId === null ? undefined : String(input.chineseClientId),
        hasChineseClientName: Boolean(clientName),
      });
    }
    return result.title;
  }
}
