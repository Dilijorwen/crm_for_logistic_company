import { normalizeText, type EntityId } from '../domain/shared/Identifiers';
import type {
  GovernanceLogger,
  GovernanceTransaction,
  ProcessGovernanceRepository,
} from './ports/ProcessGovernanceRepository';

export interface RefreshChineseClientProcessTitlesInput {
  clientId: EntityId | null;
  clientName: unknown;
  transaction?: GovernanceTransaction;
}

export class RefreshChineseClientProcessTitles {
  constructor(
    private readonly repository: ProcessGovernanceRepository,
    private readonly logger: GovernanceLogger,
  ) {}

  async execute(input: RefreshChineseClientProcessTitlesInput): Promise<void> {
    if (input.clientId === null) {
      return;
    }
    const clientName = normalizeText(input.clientName) || 'Без клиента';
    if (!normalizeText(input.clientName)) {
      this.logger.warn('Китайский клиент без имени: связанные названия процессов обновлены временным значением', {
        chineseClientId: String(input.clientId),
      });
    }
    await this.repository.refreshTitlesForChineseClient(input.clientId, clientName, input.transaction);
  }
}
