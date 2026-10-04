import { ref } from 'vue';
import { supabase } from '../../supabase';
import type { SiteRule as LocalSiteRule, WatchRecord } from '../../shared/types';
import { STORAGE_KEYS } from '../../shared/constants';
import { logger } from '../../shared/logger';
import {
  clearRememberedDataKey,
  clearSessionDataKey,
  getSessionDataKey,
  getVerifiedKeySalt,
  hasCloudEncryptionKey,
  initializeEncryption,
  restoreRememberedDataKey,
  unlockEncryption,
} from '../../shared/keyManager';
import { resetEncryptedCloudData, syncEncryptedData, uploadEncryptedSyncBlob } from '../../shared/encryptedSync';
import { StorageManager } from '../../shared/storage';

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

export function useSync() {
  async function resetEncryptedSync(password: string) {
    if (isSyncing.value) return { success: false as const, error: 'Sync is already running.' };
    try {
      const result = await withSyncState(async () => {
        const [records, sites, deleted] = await Promise.all([
          StorageManager.getRecords(), StorageManager.getSiteRules(), StorageManager.getDeletedRecords(),
        ]);
        return resetEncryptedCloudData(password, records, sites, deleted);
      });
      return { success: true as const, ...result };
    } catch (error: any) {
      return { success: false as const, error: error.message };
    }
  }
  async function loadSyncMeta(): Promise<SyncMeta> {
    const data = await chrome.storage.local.get(STORAGE_KEYS.SYNC_META);
    syncMeta.value = { ...DEFAULT_SYNC_META, ...data[STORAGE_KEYS.SYNC_META] };
    if (syncMeta.value.state === 'syncing' && !isSyncing.value) {
      syncMeta.value = { ...syncMeta.value, state: 'idle', lastError: undefined };
      await chrome.storage.local.set({ [STORAGE_KEYS.SYNC_META]: syncMeta.value });
    }
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

  async function hasEncryptedCloudSync() {
    try {
      return await hasCloudEncryptionKey();
    } catch (error) {
      logger.error('Check encrypted sync failed:', error);
      return false;
    }
  }

  function isEncryptedSyncUnlocked() {
    return Boolean(getSessionDataKey());
  }

  function lockEncryptedSync() {
    clearSessionDataKey();
  }

  async function restoreEncryptedSyncUnlock() {
    try {
      if (!await restoreRememberedDataKey()) return false;
      await getVerifiedKeySalt();
      return true;
    } catch (error) {
      logger.error('Restore encrypted sync unlock failed:', error);
      return false;
    }
  }

  async function clearEncryptedSyncUnlock() {
    await clearRememberedDataKey();
  }

  async function initializeEncryptedSync(password: string, localRecords: WatchRecord[], localSites: LocalSiteRule[]) {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      await withSyncState(async () => {
        const localDeletedRecords = await StorageManager.getDeletedRecords();
        await initializeEncryption(password);
        await uploadEncryptedSyncBlob(localRecords, localSites, localDeletedRecords);
      });

      return { success: true, syncedAt: syncMeta.value.lastSyncAt };
    } catch (error: any) {
      logger.error('Initialize encrypted sync failed:', error);
      return { success: false, error: error.message };
    }
  }

  async function unlockEncryptedSync(password: string) {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      await unlockEncryption(password);
      return { success: true };
    } catch (error: any) {
      logger.error('Unlock encrypted sync failed:', error);
      return { success: false, error: error.message };
    }
  }

  async function syncEncryptedRecordsAndSites(localRecords: WatchRecord[], localSites: LocalSiteRule[]) {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const localDeletedRecords = await StorageManager.getDeletedRecords();
      const synced = await withSyncState(() => syncEncryptedData(localRecords, localSites, localDeletedRecords));
      await chrome.storage.local.set({ [STORAGE_KEYS.RECORDS]: synced.records });
      await StorageManager.setDeletedRecords(synced.deletedRecords);
      return { success: true, ...synced, syncedAt: syncMeta.value.lastSyncAt };
    } catch (error: any) {
      logger.error('Encrypted sync failed:', error);
      return { success: false, error: error.message };
    }
  }

  return {
    resetEncryptedSync,
    isSyncing,
    syncMeta,
    loadSyncMeta,
    hasEncryptedCloudSync,
    isEncryptedSyncUnlocked,
    lockEncryptedSync,
    restoreEncryptedSyncUnlock,
    clearEncryptedSyncUnlock,
    initializeEncryptedSync,
    unlockEncryptedSync,
    syncEncryptedRecordsAndSites,
  };
}
