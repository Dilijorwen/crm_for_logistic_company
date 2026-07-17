export type ProcessHistoryEventType = 'created' | 'field_changed' | 'parent_added' | 'parent_removed';

export interface ProcessHistoryEntry {
  processId: string;
  eventType: ProcessHistoryEventType;
  fieldName?: string | null;
  fieldLabel?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
}

export function formatPlainHistoryValue(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? 'Да' : 'Нет';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}
