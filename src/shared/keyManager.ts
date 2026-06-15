import { supabase } from '../supabase';
import { STORAGE_KEYS } from './constants';
import {
  CRYPTO_CONFIG,
  bytesToBase64,
  base64ToBytes,
  decryptBytes,
  deriveKek,
  encryptBytes,
  exportAesKey,
  generateDataKey,
  generateSalt,
  importAesKey,
  type EncryptedPayload,
} from './crypto';

export interface UserEncryptionKeyRow {
  user_id: string;
  kdf: typeof CRYPTO_CONFIG.kdf;
  kdf_hash: typeof CRYPTO_CONFIG.kdfHash;
  kdf_iterations: number;
  salt: string;
  encrypted_data_key: EncryptedPayload;
  created_at?: string;
  updated_at?: string;
}

let sessionDataKey: CryptoKey | null = null;

interface StoredDeviceKey {
  version: 1;
  algorithm: typeof CRYPTO_CONFIG.algorithm;
  dataKey: string;
  savedAt: number;
}

async function getCurrentUserId(): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const user = (await supabase.auth.getUser()).data.user;
  if (!user) {
    throw new Error('User not authenticated');
  }

  return user.id;
}

async function fetchKeyRow(userId: string): Promise<UserEncryptionKeyRow | null> {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase
    .from('user_encryption_keys')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as UserEncryptionKeyRow | null;
}

export function getSessionDataKey(): CryptoKey | null {
  return sessionDataKey;
}

export function clearSessionDataKey() {
  sessionDataKey = null;
}

export async function rememberSessionDataKey() {
  if (!sessionDataKey) return;

  const rawDataKey = await exportAesKey(sessionDataKey);
  const stored: StoredDeviceKey = {
    version: 1,
    algorithm: CRYPTO_CONFIG.algorithm,
    dataKey: bytesToBase64(rawDataKey),
    savedAt: Date.now(),
  };

  await chrome.storage.local.set({ [STORAGE_KEYS.ENCRYPTION_DEVICE_KEY]: stored });
}

export async function restoreRememberedDataKey(): Promise<CryptoKey | null> {
  if (sessionDataKey) return sessionDataKey;

  const data = await chrome.storage.local.get(STORAGE_KEYS.ENCRYPTION_DEVICE_KEY);
  const stored = data[STORAGE_KEYS.ENCRYPTION_DEVICE_KEY] as StoredDeviceKey | undefined;
  if (!stored || stored.version !== 1 || stored.algorithm !== CRYPTO_CONFIG.algorithm) {
    return null;
  }

  sessionDataKey = await importAesKey(base64ToBytes(stored.dataKey));
  return sessionDataKey;
}

export async function clearRememberedDataKey() {
  clearSessionDataKey();
  await chrome.storage.local.remove(STORAGE_KEYS.ENCRYPTION_DEVICE_KEY);
}

export async function hasCloudEncryptionKey(): Promise<boolean> {
  const userId = await getCurrentUserId();
  return Boolean(await fetchKeyRow(userId));
}

export async function initializeEncryption(password: string): Promise<UserEncryptionKeyRow> {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const userId = await getCurrentUserId();
  const dataKey = await generateDataKey();
  const rawDataKey = await exportAesKey(dataKey);
  const salt = generateSalt();
  const kek = await deriveKek(password, salt);
  const encryptedDataKey = await encryptBytes(rawDataKey, kek);

  const row: UserEncryptionKeyRow = {
    user_id: userId,
    kdf: CRYPTO_CONFIG.kdf,
    kdf_hash: CRYPTO_CONFIG.kdfHash,
    kdf_iterations: CRYPTO_CONFIG.kdfIterations,
    salt,
    encrypted_data_key: encryptedDataKey,
  };

  const { data, error } = await supabase
    .from('user_encryption_keys')
    .upsert(row, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  sessionDataKey = dataKey;
  await rememberSessionDataKey();
  return data as UserEncryptionKeyRow;
}

export async function unlockEncryption(password: string): Promise<CryptoKey> {
  const userId = await getCurrentUserId();
  const row = await fetchKeyRow(userId);
  if (!row) {
    throw new Error('Cloud encryption is not initialized');
  }

  try {
    const kek = await deriveKek(password, row.salt, row.kdf_iterations);
    const rawDataKey = await decryptBytes(row.encrypted_data_key, kek);
    sessionDataKey = await importAesKey(rawDataKey);
    await rememberSessionDataKey();
    return sessionDataKey;
  } catch {
    throw new Error('同步加密密码不正确，无法解密云端数据。');
  }
}

export async function requireSessionDataKey(): Promise<CryptoKey> {
  if (!sessionDataKey) {
    throw new Error('Encryption is locked');
  }

  return sessionDataKey;
}

export async function changeEncryptionPassword(oldPassword: string, newPassword: string): Promise<UserEncryptionKeyRow> {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const userId = await getCurrentUserId();
  const dataKey = await unlockEncryption(oldPassword);
  const rawDataKey = await exportAesKey(dataKey);
  const newSalt = generateSalt();
  const newKek = await deriveKek(newPassword, newSalt);
  const encryptedDataKey = await encryptBytes(rawDataKey, newKek);

  const updates = {
    kdf: CRYPTO_CONFIG.kdf,
    kdf_hash: CRYPTO_CONFIG.kdfHash,
    kdf_iterations: CRYPTO_CONFIG.kdfIterations,
    salt: newSalt,
    encrypted_data_key: encryptedDataKey,
  };

  const { data, error } = await supabase
    .from('user_encryption_keys')
    .update(updates)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data as UserEncryptionKeyRow;
}
