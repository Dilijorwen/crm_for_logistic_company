import type { DocumentStorage, StoreDocumentInput } from '../../../application/ports/DocumentStorage';
import { MinioS3Client, type MinioS3Config } from './MinioS3Client';

export class MinioDocumentStorage implements DocumentStorage {
  private readonly client: MinioS3Client;

  constructor(config: MinioS3Config) {
    this.client = new MinioS3Client(config);
  }

  ensureReady(): Promise<void> {
    return this.client.ensureBucket();
  }

  store(input: StoreDocumentInput): Promise<void> {
    return this.client.putObject({
      key: input.key,
      filePath: input.filePath,
      size: input.size,
      contentType: input.contentType,
    });
  }

  open(key: string): Promise<unknown> {
    return this.client.getObject(key);
  }

  delete(key: string): Promise<boolean> {
    return this.client.deleteObject(key);
  }
}

export function readMinioConfig(environment: NodeJS.ProcessEnv): MinioS3Config {
  const accessKey = environment.PROCESS_DOCUMENTS_MINIO_ACCESS_KEY;
  const secretKey = environment.PROCESS_DOCUMENTS_MINIO_SECRET_KEY;
  if (!accessKey || !secretKey) {
    throw new Error('PROCESS_DOCUMENTS_MINIO_ACCESS_KEY and PROCESS_DOCUMENTS_MINIO_SECRET_KEY are required.');
  }

  return {
    endpoint: environment.PROCESS_DOCUMENTS_MINIO_ENDPOINT || 'http://minio:9000',
    region: environment.PROCESS_DOCUMENTS_MINIO_REGION || 'us-east-1',
    accessKey,
    secretKey,
    bucket: environment.PROCESS_DOCUMENTS_MINIO_BUCKET || 'log-company-process-documents',
  };
}
