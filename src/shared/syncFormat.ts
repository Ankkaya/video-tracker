import type { EncryptedPayload } from './crypto';

/** Data schema and encryption envelope have independent versions. */
export const SYNC_SCHEMA_VERSION = 2;
export const SYNC_ENCRYPTION_VERSION = 1;

export interface EncryptedSyncBlobRow {
  user_id: string;
  schema_version: typeof SYNC_SCHEMA_VERSION;
  encryption_version: typeof SYNC_ENCRYPTION_VERSION;
  encrypted_blob: EncryptedPayload;
  created_at?: string;
  updated_at?: string;
}
