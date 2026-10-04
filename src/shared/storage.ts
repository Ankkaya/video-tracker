import { normalizeDomain } from './siteRules';
import type { WatchRecord, Settings, SiteRule, DeletedRecord } from './types';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from './constants';

function getRecordKey(record: Pick<WatchRecord, 'platform' | 'url'>): string {
  return `${record.platform}::${record.url}`;
}

/** chrome.storage.local CRUD 封装 */
export const StorageManager = {
  // ====== Records ======

  /** 获取所有记录 */
  async getRecords(): Promise<WatchRecord[]> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.RECORDS);
    return result[STORAGE_KEYS.RECORDS] ?? [];
  },

  /** 保存/更新记录（upsert by id） */
  async saveRecord(record: WatchRecord): Promise<void> {
    const records = await this.getRecords();
    const idx = records.findIndex((r) => r.id === record.id);
    if (idx >= 0) {
      records[idx] = record;
    } else {
      records.unshift(record);
    }
    await chrome.storage.local.set({ [STORAGE_KEYS.RECORDS]: records });
    await this.clearDeletedRecordIfSuperseded(record);
  },

  /** 按 URL 查找记录 */
  async findRecordByUrl(url: string): Promise<WatchRecord | undefined> {
    const records = await this.getRecords();
    return records.find((r) => r.url === url);
  },

  /** 删除记录 */
  async deleteRecord(id: string): Promise<void> {
    const records = await this.getRecords();
    const deleted = records.find((r) => r.id === id);
    const filtered = records.filter((r) => r.id !== id);
    await chrome.storage.local.set({ [STORAGE_KEYS.RECORDS]: filtered });
    if (deleted) {
      await this.markRecordDeleted(deleted);
    }
  },

  /** 批量删除记录 */
  async deleteRecords(ids: string[]): Promise<void> {
    const records = await this.getRecords();
    const idSet = new Set(ids);
    const deleted = records.filter((r) => idSet.has(r.id));
    const filtered = records.filter((r) => !ids.includes(r.id));
    await chrome.storage.local.set({ [STORAGE_KEYS.RECORDS]: filtered });
    if (deleted.length) {
      await this.markRecordsDeleted(deleted);
    }
  },

  async getDeletedRecords(): Promise<DeletedRecord[]> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.DELETED_RECORDS);
    return result[STORAGE_KEYS.DELETED_RECORDS] ?? [];
  },

  async setDeletedRecords(deletedRecords: DeletedRecord[]): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.DELETED_RECORDS]: deletedRecords });
  },

  async markRecordDeleted(record: WatchRecord): Promise<void> {
    await this.markRecordsDeleted([record]);
  },

  async markRecordsDeleted(records: WatchRecord[]): Promise<void> {
    const deletedRecords = await this.getDeletedRecords();
    const byKey = new Map(deletedRecords.map((item) => [item.key, item]));
    const deletedAt = Date.now();

    for (const record of records) {
      const key = getRecordKey(record);
      const existing = byKey.get(key);
      byKey.set(key, {
        key,
        deletedAt: Math.max(existing?.deletedAt ?? 0, deletedAt),
      });
    }

    await this.setDeletedRecords(Array.from(byKey.values()));
  },

  async clearDeletedRecordIfSuperseded(record: WatchRecord): Promise<void> {
    const deletedRecords = await this.getDeletedRecords();
    const key = getRecordKey(record);
    const recordUpdatedAt = Math.max(record.lastWatchedAt, record.createdAt);
    const next = deletedRecords.filter((item) => item.key !== key || item.deletedAt >= recordUpdatedAt);

    if (next.length !== deletedRecords.length) {
      await this.setDeletedRecords(next);
    }
  },

  // ====== Settings ======

  /** 获取设置（带默认值） */
  async getSettings(): Promise<Settings> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    const stored = result[STORAGE_KEYS.SETTINGS] ?? {};
    return {
      autoRecord: stored.autoRecord ?? DEFAULT_SETTINGS.autoRecord,
      autoSync: stored.autoSync ?? DEFAULT_SETTINGS.autoSync,
      threshold: stored.threshold ?? DEFAULT_SETTINGS.threshold,
      shortcut: stored.shortcut ?? DEFAULT_SETTINGS.shortcut,
      siteRules: stored.siteRules ?? [],
    };
  },

  /** 更新设置（合并） */
  async updateSettings(partial: Partial<Settings>): Promise<void> {
    const current = await this.getSettings();
    await chrome.storage.local.set({
      [STORAGE_KEYS.SETTINGS]: { ...current, ...partial },
    });
  },

  async getSiteRules(): Promise<SiteRule[]> {
    return (await this.getSettings()).siteRules;
  },

  async setSiteRule(domain: string, autoRecord: boolean): Promise<SiteRule[]> {
    domain = normalizeDomain(domain);
    const sites = await this.getSiteRules();
    const updated = [...sites.filter(s => s.domain !== domain), { domain, autoRecord, updatedAt: Date.now() }];
    await this.updateSettings({ siteRules: updated });
    return updated;
  },
};
