import { supabase } from '../supabase';
import type { SiteRule, DeletedRecord, WatchRecord } from './types';
import { CRYPTO_CONFIG, decryptJson, encryptJson, deriveKek, encryptBytes, exportAesKey, generateDataKey, generateSalt } from './crypto';
import { getVerifiedDataKey, getVerifiedKeySalt, rememberResetDataKey, requireSessionDataKey } from './keyManager';
import { SYNC_SCHEMA_VERSION, SYNC_ENCRYPTION_VERSION, type EncryptedSyncBlobRow } from './syncFormat';
export type { EncryptedSyncBlobRow } from './syncFormat';

export interface SyncPlaintext {
  version: typeof SYNC_SCHEMA_VERSION;
  exportedAt: number;
  records: WatchRecord[];
  deletedRecords?: DeletedRecord[];
  siteRules: SiteRule[];
}


function getRecordKey(record: Pick<WatchRecord, 'platform' | 'url'>): string {
  return `${record.platform}::${record.url}`;
}

function getRecordUpdatedAt(record: WatchRecord): number {
  return Math.max(record.lastWatchedAt, record.createdAt);
}

function preferText(newer?: string, older?: string): string | undefined {
  return newer || older;
}

function mergeRecordPair(localRecord: WatchRecord, cloudRecord: WatchRecord): WatchRecord {
  const localWins = localRecord.lastWatchedAt >= cloudRecord.lastWatchedAt;
  const newer = localWins ? localRecord : cloudRecord;
  const older = localWins ? cloudRecord : localRecord;

  return {
    ...older,
    ...newer,
    id: localRecord.id || cloudRecord.id,
    url: newer.url || older.url,
    title: preferText(newer.title, older.title) || '未命名视频',
    episode: newer.episode || older.episode || '正片',
    platform: newer.platform || older.platform,
    platformName: preferText(newer.platformName, older.platformName) || newer.platform || older.platform,
    currentTime: newer.currentTime > 0 ? newer.currentTime : older.currentTime,
    duration: newer.duration > 0 ? newer.duration : older.duration,
    progress: newer.progress > 0 ? newer.progress : older.progress,
    thumbnail: preferText(newer.thumbnail, older.thumbnail),
    notes: preferText(newer.notes, older.notes),
    lastWatchedAt: Math.max(localRecord.lastWatchedAt, cloudRecord.lastWatchedAt),
    createdAt: Math.min(localRecord.createdAt, cloudRecord.createdAt),
  };
}

export function mergeEncryptedDeletedRecords(localDeletedRecords: DeletedRecord[], cloudDeletedRecords: DeletedRecord[]): DeletedRecord[] {
  const merged = new Map<string, DeletedRecord>();

  for (const deletedRecord of [...localDeletedRecords, ...cloudDeletedRecords]) {
    const existing = merged.get(deletedRecord.key);
    if (!existing || deletedRecord.deletedAt > existing.deletedAt) {
      merged.set(deletedRecord.key, deletedRecord);
    }
  }

  return Array.from(merged.values());
}

export function mergeEncryptedRecords(
  localRecords: WatchRecord[],
  cloudRecords: WatchRecord[],
  deletedRecords: DeletedRecord[] = [],
): WatchRecord[] {
  const merged = new Map<string, WatchRecord>();
  const deletedByKey = new Map(deletedRecords.map((record) => [record.key, record.deletedAt]));

  function setIfNotDeleted(record: WatchRecord) {
    const key = getRecordKey(record);
    const deletedAt = deletedByKey.get(key) ?? 0;
    if (deletedAt >= getRecordUpdatedAt(record)) {
      return;
    }

    const existing = merged.get(key);
    merged.set(key, existing ? mergeRecordPair(existing, record) : record);
  }

  for (const localRecord of localRecords) {
    setIfNotDeleted(localRecord);
  }

  for (const cloudRecord of cloudRecords) {
    setIfNotDeleted(cloudRecord);
  }

  return Array.from(merged.values()).sort((a, b) => b.lastWatchedAt - a.lastWatchedAt);
}

export function pruneSupersededDeletedRecords(records: WatchRecord[], deletedRecords: DeletedRecord[]): DeletedRecord[] {
  const recordUpdatedByKey = new Map(records.map((record) => [getRecordKey(record), getRecordUpdatedAt(record)]));
  return deletedRecords.filter((deletedRecord) => {
    const recordUpdatedAt = recordUpdatedByKey.get(deletedRecord.key) ?? 0;
    return deletedRecord.deletedAt >= recordUpdatedAt;
  });
}

export function mergeEncryptedSiteRules(localSites: SiteRule[], cloudSites: SiteRule[]): SiteRule[] {
  const merged = new Map<string, SiteRule>();

  for (const site of localSites) {
    merged.set(site.domain, site);
  }

  for (const site of cloudSites) {
    const existing = merged.get(site.domain);
    if (!existing || site.updatedAt >= existing.updatedAt) {
      merged.set(site.domain, site);
    }
  }

  return Array.from(merged.values()).sort((a, b) => a.domain.localeCompare(b.domain));
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

export function createSyncPlaintext(
  records: WatchRecord[],
  siteRules: SiteRule[],
  deletedRecords: DeletedRecord[] = [],
): SyncPlaintext {
  return {
    version: SYNC_SCHEMA_VERSION,
    exportedAt: Date.now(),
    records,
    deletedRecords,
    siteRules,
  };
}

export async function uploadEncryptedSyncBlob(
  records: WatchRecord[],
  siteRules: SiteRule[],
  deletedRecords: DeletedRecord[] = [],
): Promise<EncryptedSyncBlobRow> {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const userId = await getCurrentUserId();
  const { key: dataKey, salt: keySalt } = await getVerifiedDataKey();
  const encryptedBlob = await encryptJson(createSyncPlaintext(records, siteRules, deletedRecords), dataKey);
  if (keySalt !== await getVerifiedKeySalt()) {
    throw new Error('Cloud encryption changed during sync. Please sync again.');
  }
  encryptedBlob.key_salt = keySalt;
  const row = {
    user_id: userId,
    schema_version: SYNC_SCHEMA_VERSION,
    encryption_version: SYNC_ENCRYPTION_VERSION,
    encrypted_blob: encryptedBlob,
  };

  const { data, error } = await supabase
    .from('encrypted_sync_blobs')
    .upsert(row, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data as EncryptedSyncBlobRow;
}

/** The RPC replaces both rows in one transaction and rejects concurrent key changes. */
export async function resetEncryptedCloudData(password: string, records: WatchRecord[], siteRules: SiteRule[], deletedRecords: DeletedRecord[] = []) {
  if (!supabase) throw new Error('Supabase not configured');
  if (!password.trim()) throw new Error('Please enter a new sync password.');
  const userId = await getCurrentUserId();
  const { data: previous, error: readError } = await supabase.from('user_encryption_keys')
    .select('salt').eq('user_id', userId).maybeSingle();
  if (readError) throw readError;
  const key = await generateDataKey();
  const salt = generateSalt();
  const kek = await deriveKek(password, salt);
  const wrapped = await encryptBytes(await exportAesKey(key), kek);
  wrapped.reset_version = 1;
  const blob = await encryptJson(createSyncPlaintext(records, siteRules, deletedRecords), key);
  blob.key_salt = salt;
  const { error } = await supabase.rpc('reset_encrypted_sync', {
    p_expected_salt: previous?.salt ?? null,
    p_salt: salt,
    p_encrypted_data_key: wrapped,
    p_encrypted_blob: blob,
    p_kdf_iterations: CRYPTO_CONFIG.kdfIterations,
  });
  if (error) throw error;
  // Do not replace the local key until the cloud transaction has committed.
  try {
    await rememberResetDataKey(key, salt, userId);
  } catch {
    // Cloud reset succeeded; the user can unlock with their new password.
    return { deviceRemembered: false };
  }
  return { deviceRemembered: true };
}

export async function downloadEncryptedSyncBlob(): Promise<SyncPlaintext | null> {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const userId = await getCurrentUserId();
  const dataKey = await requireSessionDataKey();
  const { data, error } = await supabase
    .from('encrypted_sync_blobs')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as EncryptedSyncBlobRow;
  if (row.schema_version !== SYNC_SCHEMA_VERSION) {
    throw new Error('云端同步格式不受支持。旧格式请使用当前设备数据重置云端同步；更高版本请升级插件。');
  }
  if (row.encryption_version !== SYNC_ENCRYPTION_VERSION) throw new Error('Unsupported encryption version');

  try {
    const plaintext = await decryptJson<SyncPlaintext>(row.encrypted_blob, dataKey);
    validateSyncPlaintext(plaintext);
    return plaintext;
  } catch {
    throw new Error('云端同步数据无法解密。请检查同步加密密码，或使用当前设备数据重置云端同步。');
  }
}

export function validateSyncPlaintext(value: unknown): asserts value is SyncPlaintext {
  const data = value as Partial<SyncPlaintext> | null;
  if (!data || data.version !== SYNC_SCHEMA_VERSION
    || !Number.isFinite(data.exportedAt)
    || !Array.isArray(data.records) || !Array.isArray(data.siteRules)
    || (data.deletedRecords !== undefined && !Array.isArray(data.deletedRecords))) {
    throw new Error('Unsupported sync format: expected v2 records and siteRules');
  }
}

export async function syncEncryptedData(
  localRecords: WatchRecord[],
  localSites: SiteRule[],
  localDeletedRecords: DeletedRecord[] = [],
) {
  const cloudPlaintext = await downloadEncryptedSyncBlob();
  const mergedDeletedRecords = mergeEncryptedDeletedRecords(localDeletedRecords, cloudPlaintext?.deletedRecords ?? []);
  const mergedRecords = mergeEncryptedRecords(localRecords, cloudPlaintext?.records ?? [], mergedDeletedRecords);
  const activeDeletedRecords = pruneSupersededDeletedRecords(mergedRecords, mergedDeletedRecords);
  const mergedSites = mergeEncryptedSiteRules(localSites, cloudPlaintext?.siteRules ?? []);

  await uploadEncryptedSyncBlob(mergedRecords, mergedSites, activeDeletedRecords);

  return {
    records: mergedRecords,
    deletedRecords: activeDeletedRecords,
    siteRules: mergedSites,
  };
}
