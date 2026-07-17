import { normalizeText } from '../shared/Identifiers';

export interface ProcessTitleParts {
  processNumber: unknown;
  carNumber: unknown;
  clientName: unknown;
}

export interface ProcessTitleResult {
  title: string;
  isIncomplete: boolean;
}

export function buildProcessTitle(parts: ProcessTitleParts): ProcessTitleResult {
  const processNumber = normalizeText(parts.processNumber);
  const carNumber = normalizeText(parts.carNumber);
  const clientName = normalizeText(parts.clientName);
  return {
    title: `${processNumber || 'Без номера процесса'} - ${carNumber || 'Без номера'} с ${clientName || 'Без клиента'}`,
    isIncomplete: !processNumber || !carNumber || !clientName,
  };
}
