export interface StoreDocumentInput {
  key: string;
  filePath: string;
  size: number;
  contentType: string;
}

export interface DocumentStorage {
  ensureReady(): Promise<void>;
  store(input: StoreDocumentInput): Promise<void>;
  open(key: string): Promise<unknown>;
  delete(key: string): Promise<boolean>;
}

export interface StorageKeyGenerator {
  generate(ownerPath: string, originalFilename: string): string;
}

export interface IdentifierGenerator {
  generate(): string;
}

export interface ApplicationLogger {
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, error: unknown, metadata?: Record<string, unknown>): void;
}
