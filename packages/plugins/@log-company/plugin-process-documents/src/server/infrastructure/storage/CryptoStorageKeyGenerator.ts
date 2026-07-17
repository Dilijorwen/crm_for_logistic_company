import crypto from 'crypto';
import { safeStorageExtension } from '../../domain/documents/DocumentName';
import type { StorageKeyGenerator } from '../../application/ports/DocumentStorage';

export class CryptoStorageKeyGenerator implements StorageKeyGenerator {
  generate(ownerPath: string, originalFilename: string): string {
    return `processes/${ownerPath}/${crypto.randomUUID()}${safeStorageExtension(originalFilename)}`;
  }
}
