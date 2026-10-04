import { createClient } from '@supabase/supabase-js';
import type { EncryptedPayload } from '../shared/crypto';
export type { EncryptedPayload } from '../shared/crypto';
export type { EncryptedSyncBlobRow as EncryptedSyncBlob } from '../shared/syncFormat';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;


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

