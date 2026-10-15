import type { WatchRecord, Settings, SiteRule } from '../../shared/types';
import { MSG } from '../../shared/constants';

export class BackgroundUnavailableError extends Error {}

/** 与 background 通信的轻量封装 */
export const api = {
  async setCompleted(id: string, completed: boolean): Promise<WatchRecord | undefined> {
    try {
      const res = await chrome.runtime.sendMessage({ type: MSG.SET_RECORD_COMPLETED, data: { id, completed } });
      if (!res || res.error === 'Unknown message type') throw new BackgroundUnavailableError('Background unavailable or outdated');
      if (!res.success) throw new Error(res.error || 'Update failed');
      return res.record;
    } catch (error) {
      if (error instanceof Error && /receiving end does not exist|could not establish connection|extension context invalidated|message (?:port|channel) closed/i.test(error.message)) {
        throw new BackgroundUnavailableError(error.message);
      }
      throw error;
    }
  },
  async getRecords(): Promise<WatchRecord[]> {
    const res = await chrome.runtime.sendMessage({ type: MSG.GET_ALL_RECORDS });
    if (!res?.records || res.error) throw new Error(res?.error || 'Records unavailable');
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
    const res = await chrome.runtime.sendMessage({ type: MSG.UPDATE_SETTINGS, data: partial });
    if (!res?.success) throw new Error(res?.error || 'Unable to save settings');
  },

  async setSiteRule(domain: string, autoRecord: boolean): Promise<SiteRule[]> {
    const res = await chrome.runtime.sendMessage({ type: MSG.SET_SITE_RULE, data: { domain, autoRecord } });
    if (!res?.success) throw new Error(res?.error || 'Unable to save site rule');
    return res.siteRules;
  },
};
