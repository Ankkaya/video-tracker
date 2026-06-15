import { supabase } from '../supabase';
import type { CustomSite, WatchRecord } from './types';
import { decryptJson, encryptJson, type EncryptedPayload } from './crypto';
import { requireSessionDataKey } from './keyManager';

export interface SyncPlaintext {
  version: 1;
  exportedAt: number;
  records: WatchRecord[];
  customSites: CustomSite[];
}

export interface EncryptedSyncBlobRow {
  user_id: string;
  schema_version: number;
  encryption_version: number;
  encrypted_blob: EncryptedPayload;
  created_at?: string;
  updated_at?: string;
}

function getRecordKey(record: Pick<WatchRecord, 'platform' | 'url'>): string {
  return `${record.platform}::${record.url}`;
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

export function mergeEncryptedRecords(localRecords: WatchRecord[], cloudRecords: WatchRecord[]): WatchRecord[] {
  const merged = new Map<string, WatchRecord>();

  for (const localRecord of localRecords) {
    merged.set(getRecordKey(localRecord), localRecord);
  }

  for (const cloudRecord of cloudRecords) {
    const key = getRecordKey(cloudRecord);
    const existing = merged.get(key);
    merged.set(key, existing ? mergeRecordPair(existing, cloudRecord) : cloudRecord);
  }

  return Array.from(merged.values()).sort((a, b) => b.lastWatchedAt - a.lastWatchedAt);
}

export function mergeEncryptedCustomSites(localSites: CustomSite[], cloudSites: CustomSite[]): CustomSite[] {
  const merged = new Map<string, CustomSite>();

  for (const site of localSites) {
    merged.set(site.domain, site);
  }

  for (const site of cloudSites) {
    const existing = merged.get(site.domain);
    if (!existing || site.addedAt >= existing.addedAt) {
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

export function createSyncPlaintext(records: WatchRecord[], customSites: CustomSite[]): SyncPlaintext {
  return {
    version: 1,
    exportedAt: Date.now(),
    records,
    customSites,
  };
}

export async function uploadEncryptedSyncBlob(records: WatchRecord[], customSites: CustomSite[]): Promise<EncryptedSyncBlobRow> {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const userId = await getCurrentUserId();
  const dataKey = await requireSessionDataKey();
  const encryptedBlob = await encryptJson(createSyncPlaintext(records, customSites), dataKey);
  const row = {
    user_id: userId,
    schema_version: 1,
    encryption_version: 1,
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
  if (row.schema_version > 1 || row.encryption_version > 1) {
    throw new Error('云端同步数据由更高版本创建，请升级插件后再同步。');
  }

  try {
    return await decryptJson<SyncPlaintext>(row.encrypted_blob, dataKey);
  } catch {
    throw new Error('云端同步数据无法解密。请检查同步加密密码，或使用当前设备数据重置云端同步。');
  }
}

export async function syncEncryptedData(localRecords: WatchRecord[], localSites: CustomSite[]) {
  const cloudPlaintext = await downloadEncryptedSyncBlob();
  const mergedRecords = mergeEncryptedRecords(localRecords, cloudPlaintext?.records ?? []);
  const mergedSites = mergeEncryptedCustomSites(localSites, cloudPlaintext?.customSites ?? []);

  await uploadEncryptedSyncBlob(mergedRecords, mergedSites);

  return {
    records: mergedRecords,
    customSites: mergedSites,
  };
}
