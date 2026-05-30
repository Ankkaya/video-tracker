import { ref } from 'vue';
import { supabase, type Record, type CustomSite } from '../../supabase';
import type { CustomSite as LocalCustomSite, WatchRecord } from '../../shared/types';
import { PLATFORM_NAMES, STORAGE_KEYS } from '../../shared/constants';
import { logger } from '../../shared/logger';

export type SyncState = 'idle' | 'syncing' | 'success' | 'error';

export interface SyncMeta {
  state: SyncState;
  lastSyncAt: number | null;
  lastError?: string;
}

const DEFAULT_SYNC_META: SyncMeta = {
  state: 'idle',
  lastSyncAt: null,
};

const isSyncing = ref(false);
const syncMeta = ref<SyncMeta>({ ...DEFAULT_SYNC_META });

function getRecordKey(record: Pick<WatchRecord, 'platform' | 'url'>): string {
  return `${record.platform}::${record.url}`;
}

function getCloudRecordId(record: Pick<WatchRecord, 'platform' | 'url'>): string {
  return getRecordKey(record);
}

function toCloudRecord(record: WatchRecord, userId: string): Record {
  return {
    id: getCloudRecordId(record),
    user_id: userId,
    platform: record.platform,
    video_id: record.id,
    url: record.url,
    title: record.title,
    thumbnail: record.thumbnail,
    progress: record.progress,
    duration: record.duration,
    watched_at: new Date(record.lastWatchedAt).toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function fromCloudRecord(record: Record): WatchRecord {
  const duration = Number(record.duration ?? 0);
  const progress = Number(record.progress ?? 0);
  const currentTime = duration > 0 ? progress * duration : 0;
  return {
    id: record.video_id || record.id,
    url: record.url,
    title: record.title,
    episode: '正片',
    platform: record.platform,
    platformName: PLATFORM_NAMES[record.platform] || record.platform,
    currentTime,
    duration,
    progress,
    thumbnail: record.thumbnail,
    lastWatchedAt: new Date(record.watched_at).getTime(),
    createdAt: new Date(record.updated_at || record.watched_at).getTime(),
  };
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
    lastWatchedAt: Math.max(localRecord.lastWatchedAt, cloudRecord.lastWatchedAt),
    createdAt: Math.min(localRecord.createdAt, cloudRecord.createdAt),
  };
}

function mergeRecords(localRecords: WatchRecord[], cloudRecords: WatchRecord[]): WatchRecord[] {
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

export function useSync() {
  async function loadSyncMeta(): Promise<SyncMeta> {
    const data = await chrome.storage.local.get(STORAGE_KEYS.SYNC_META);
    syncMeta.value = { ...DEFAULT_SYNC_META, ...data[STORAGE_KEYS.SYNC_META] };
    return syncMeta.value;
  }

  async function setSyncMeta(partial: Partial<SyncMeta>) {
    syncMeta.value = { ...syncMeta.value, ...partial };
    const storedMeta = { ...syncMeta.value };
    if (!storedMeta.lastError) {
      delete storedMeta.lastError;
    }
    await chrome.storage.local.set({ [STORAGE_KEYS.SYNC_META]: storedMeta });
  }

  async function withSyncState<T>(operation: () => Promise<T>): Promise<T> {
    isSyncing.value = true;
    await setSyncMeta({ state: 'syncing', lastError: undefined });

    try {
      const result = await operation();
      await setSyncMeta({ state: 'success', lastSyncAt: Date.now(), lastError: undefined });
      return result;
    } catch (error: any) {
      await setSyncMeta({ state: 'error', lastError: error?.message || String(error) });
      throw error;
    } finally {
      isSyncing.value = false;
    }
  }

  async function getCurrentUser() {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      throw new Error('User not authenticated');
    }

    return user;
  }

  async function uploadRecords(localRecords: WatchRecord[]) {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const user = await getCurrentUser();

      const recordsToUpload: Record[] = localRecords.map(record => toCloudRecord(record, user.id));

      if (recordsToUpload.length === 0) {
        return { success: true };
      }

      const { error } = await supabase
        .from('records')
        .upsert(recordsToUpload, { onConflict: 'id' });

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      logger.error('Upload failed:', error);
      return { success: false, error: error.message };
    }
  }

  async function downloadRecords(): Promise<WatchRecord[]> {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    try {
      const user = await getCurrentUser();

      const { data, error } = await supabase
        .from('records')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      return (data || []).map(fromCloudRecord);
    } catch (error: any) {
      logger.error('Download failed:', error);
      throw error;
    }
  }

  async function syncRecords(localRecords: WatchRecord[]) {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const mergedRecords = await withSyncState(async () => {
        const cloudRecords = await downloadRecords();
        const merged = mergeRecords(localRecords, cloudRecords);
        const uploadResult = await uploadRecords(merged);
        if (!uploadResult.success) {
          throw new Error(uploadResult.error);
        }
        return merged;
      });

      await chrome.storage.local.set({ [STORAGE_KEYS.RECORDS]: mergedRecords });
      return { success: true, records: mergedRecords, syncedAt: syncMeta.value.lastSyncAt };
    } catch (error: any) {
      logger.error('Sync failed:', error);
      return { success: false, error: error.message };
    }
  }

  async function uploadCustomSites(localSites: LocalCustomSite[]) {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const user = await getCurrentUser();

      const sitesToUpload: CustomSite[] = localSites.map(site => ({
        id: site.domain,
        user_id: user.id,
        domain: site.domain,
        enabled: site.enabled,
        created_at: new Date(site.addedAt).toISOString(),
        updated_at: new Date().toISOString(),
      }));

      if (sitesToUpload.length === 0) {
        return { success: true };
      }

      const { error } = await supabase
        .from('custom_sites')
        .upsert(sitesToUpload, { onConflict: 'domain' });

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      logger.error('Upload custom sites failed:', error);
      return { success: false, error: error.message };
    }
  }

  async function downloadCustomSites(): Promise<LocalCustomSite[]> {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    try {
      const user = await getCurrentUser();

      const { data, error } = await supabase
        .from('custom_sites')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      const localSites: LocalCustomSite[] = (data || []).map(site => ({
        domain: site.domain,
        enabled: site.enabled,
        addedAt: new Date(site.created_at).getTime(),
      }));

      return localSites;
    } catch (error: any) {
      logger.error('Download custom sites failed:', error);
      throw error;
    }
  }

  async function syncCustomSites(localSites: LocalCustomSite[]) {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const cloudSites = await withSyncState(async () => {
        const uploadResult = await uploadCustomSites(localSites);
        if (!uploadResult.success) {
          throw new Error(uploadResult.error);
        }

        return downloadCustomSites();
      });

      return { success: true, customSites: cloudSites, syncedAt: syncMeta.value.lastSyncAt };
    } catch (error: any) {
      logger.error('Sync custom sites failed:', error);
      return { success: false, error: error.message };
    }
  }

  return {
    isSyncing,
    syncMeta,
    loadSyncMeta,
    uploadRecords,
    downloadRecords,
    syncRecords,
    uploadCustomSites,
    downloadCustomSites,
    syncCustomSites,
  };
}
