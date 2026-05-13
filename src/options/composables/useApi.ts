import type { WatchRecord, Settings, CustomSite } from '../../shared/types';
import { MSG } from '../../shared/constants';

/** 与 background 通信的轻量封装 */
export const api = {
  async getRecords(): Promise<WatchRecord[]> {
    const res = await chrome.runtime.sendMessage({ type: MSG.GET_ALL_RECORDS });
    return res?.records ?? [];
  },

  async deleteRecord(id: string): Promise<void> {
    await chrome.runtime.sendMessage({ type: MSG.DELETE_RECORD, data: { id } });
  },

  async deleteRecords(ids: string[]): Promise<void> {
    if (!ids.length) return;
    await chrome.runtime.sendMessage({ type: MSG.DELETE_RECORDS, data: { ids } });
  },

  async getSettings(): Promise<Settings | null> {
    const res = await chrome.runtime.sendMessage({ type: MSG.GET_SETTINGS });
    return res?.settings ?? null;
  },

  async updateSettings(partial: Partial<Settings>): Promise<void> {
    await chrome.runtime.sendMessage({ type: MSG.UPDATE_SETTINGS, data: partial });
  },

  async addCustomSite(domain: string): Promise<{ success: boolean; customSites?: CustomSite[]; error?: string }> {
    try {
      const res = await chrome.runtime.sendMessage({ type: MSG.ADD_CUSTOM_SITE, data: { domain } });
      return res ?? { success: false };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  },

  async removeCustomSite(domain: string): Promise<CustomSite[] | null> {
    const res = await chrome.runtime.sendMessage({ type: MSG.REMOVE_CUSTOM_SITE, data: { domain } });
    return res?.success ? (res.customSites as CustomSite[]) : null;
  },
};
