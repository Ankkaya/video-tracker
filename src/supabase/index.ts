import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export interface EncryptedPayload {
  version: 1;
  algorithm: 'AES-GCM';
  iv: string;
  data: string;
}

export interface UserEncryptionKey {
  user_id: string;
  kdf: 'PBKDF2';
  kdf_hash: 'SHA-256';
  kdf_iterations: number;
  salt: string;
  encrypted_data_key: EncryptedPayload;
  created_at: string;
  updated_at: string;
}

export interface EncryptedSyncBlob {
  user_id: string;
  schema_version: number;
  encryption_version: number;
  encrypted_blob: EncryptedPayload;
  created_at: string;
  updated_at: string;
}
