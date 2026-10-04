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
let sessionKeySalt: string | null = null;
let sessionUserId: string | null = null;

interface StoredDeviceKey {
  keySalt?: string;
  userId?: string;
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
  sessionKeySalt = null;
  sessionUserId = null;
}

export async function rememberSessionDataKey() {
  if (!sessionDataKey) return;

  const rawDataKey = await exportAesKey(sessionDataKey);
  const stored: StoredDeviceKey = {
    ...(sessionKeySalt ? { keySalt: sessionKeySalt } : {}),
    ...(sessionUserId ? { userId: sessionUserId } : {}),
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
  sessionKeySalt = stored.keySalt ?? null;
  sessionUserId = stored.userId ?? null;
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
  sessionKeySalt = salt;
  sessionUserId = userId;
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
    sessionKeySalt = row.salt;
    sessionUserId = userId;
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

  await getVerifiedKeySalt();
  return sessionDataKey!;
}

/** Validate against the cloud before every read/write, including other extension contexts. */
export async function getVerifiedKeySalt(): Promise<string> {
  const userId = await getCurrentUserId();
  const row = await fetchKeyRow(userId);
  if (sessionDataKey && row && sessionKeySalt !== row.salt) {
    const stored = (await chrome.storage.local.get(STORAGE_KEYS.ENCRYPTION_DEVICE_KEY))[STORAGE_KEYS.ENCRYPTION_DEVICE_KEY] as StoredDeviceKey | undefined;
    // Another extension context on this same device may already have reset/unlocked.
    if (stored?.keySalt === row.salt && stored.userId === userId) {
      clearSessionDataKey();
      await restoreRememberedDataKey();
    }
  }
  if (!sessionDataKey || !row || (sessionUserId && sessionUserId !== userId)
    || (sessionKeySalt && sessionKeySalt !== row.salt)
    || (!sessionKeySalt && row.encrypted_data_key.reset_version)) {
    await clearRememberedDataKey();
    throw new Error('Cloud encryption changed. Unlock sync again with the new password.');
  }
  sessionKeySalt = row.salt;
  sessionUserId = userId;
  return row.salt;
}

export async function rememberResetDataKey(key: CryptoKey, salt: string, userId: string) {
  sessionDataKey = key;
  sessionKeySalt = salt;
  sessionUserId = userId;
  await rememberSessionDataKey();
}

export async function getVerifiedDataKey(): Promise<{ key: CryptoKey; salt: string }> {
  await getVerifiedKeySalt();
  return { key: sessionDataKey!, salt: sessionKeySalt! };
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

  sessionKeySalt = newSalt;
  await rememberSessionDataKey();
  return data as UserEncryptionKeyRow;
}
