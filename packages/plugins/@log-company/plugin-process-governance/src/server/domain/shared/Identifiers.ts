export type EntityId = string | number | bigint;

export function isEmptyValue(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

export function normalizeText(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

export function sameIdentifier(left: unknown, right: unknown): boolean {
  return !isEmptyValue(left) && !isEmptyValue(right) && String(left) === String(right);
}

export function extractIdentifier(value: unknown, targetKey = 'id'): EntityId | null {
  if (isEmptyValue(value)) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.length ? extractIdentifier(value[0], targetKey) : null;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return (
      extractIdentifier(record[targetKey], targetKey) ??
      extractIdentifier(record.id, targetKey) ??
      extractIdentifier(record.value, targetKey)
    );
  }
  return null;
}

export function uniqueIdentifiers(values: unknown[]): EntityId[] {
  const seen = new Set<string>();
  const result: EntityId[] = [];
  for (const value of values) {
    const identifier = extractIdentifier(value);
    if (identifier === null || seen.has(String(identifier))) {
      continue;
    }
    seen.add(String(identifier));
    result.push(identifier);
  }
  return result;
}

export function normalizeIdentifiers(value: unknown, targetKey = 'id'): EntityId[] {
  if (isEmptyValue(value)) {
    return [];
  }
  if (Array.isArray(value)) {
    return uniqueIdentifiers(value.map((item) => extractIdentifier(item, targetKey)));
  }
  if (typeof value === 'object') {
    const directIdentifier = extractIdentifier(value, targetKey);
    if (directIdentifier !== null) {
      return [directIdentifier];
    }
    const record = value as Record<string, unknown>;
    return uniqueIdentifiers(
      Object.keys(record)
        .sort()
        .map((key) => extractIdentifier(record[key], targetKey)),
    );
  }
  const identifier = extractIdentifier(value, targetKey);
  return identifier === null ? [] : [identifier];
}
