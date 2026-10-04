import type { WatchRecord, Settings, SiteRule } from '../../shared/types';
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

  async setSiteRule(domain: string, autoRecord: boolean): Promise<SiteRule[]> {
    const res = await chrome.runtime.sendMessage({ type: MSG.SET_SITE_RULE, data: { domain, autoRecord } });
    if (!res?.success) throw new Error(res?.error || 'Unable to save site rule');
    return res.siteRules;
  },
};
