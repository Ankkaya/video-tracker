import type { WatchRecord, Settings, CustomSite } from './types';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from './constants';

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
  },

  /** 按 URL 查找记录 */
  async findRecordByUrl(url: string): Promise<WatchRecord | undefined> {
    const records = await this.getRecords();
    return records.find((r) => r.url === url);
  },

  /** 删除记录 */
  async deleteRecord(id: string): Promise<void> {
    const records = await this.getRecords();
    const filtered = records.filter((r) => r.id !== id);
    await chrome.storage.local.set({ [STORAGE_KEYS.RECORDS]: filtered });
  },

  /** 批量删除记录 */
  async deleteRecords(ids: string[]): Promise<void> {
    const records = await this.getRecords();
    const filtered = records.filter((r) => !ids.includes(r.id));
    await chrome.storage.local.set({ [STORAGE_KEYS.RECORDS]: filtered });
  },

  // ====== Settings ======

  /** 获取设置（带默认值） */
  async getSettings(): Promise<Settings> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    return { ...DEFAULT_SETTINGS, ...result[STORAGE_KEYS.SETTINGS] };
  },

  /** 更新设置（合并） */
  async updateSettings(partial: Partial<Settings>): Promise<void> {
    const current = await this.getSettings();
    await chrome.storage.local.set({
      [STORAGE_KEYS.SETTINGS]: { ...current, ...partial },
    });
  },

  // ====== Custom Sites ======

  /** 获取自定义站点列表 */
  async getCustomSites(): Promise<CustomSite[]> {
    const settings = await this.getSettings();
    return settings.customSites ?? [];
  },

  /** 添加自定义站点 */
  async addCustomSite(domain: string): Promise<CustomSite[]> {
    const settings = await this.getSettings();
    const sites = settings.customSites ?? [];
    if (sites.some((s) => s.domain === domain)) {
      return sites; // 已存在
    }
    const newSite: CustomSite = {
      domain,
      enabled: true,
      addedAt: Date.now(),
    };
    const updated = [...sites, newSite];
    await this.updateSettings({ customSites: updated });
    return updated;
  },

  /** 删除自定义站点 */
  async removeCustomSite(domain: string): Promise<CustomSite[]> {
    const settings = await this.getSettings();
    const sites = settings.customSites ?? [];
    const updated = sites.filter((s) => s.domain !== domain);
    await this.updateSettings({ customSites: updated });
    return updated;
  },
};
