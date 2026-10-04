import type { SiteRule } from '../../src/shared/types';
// Isolated screenshot fixture. This file is outside extension entrypoints/public.
const params = new URLSearchParams(location.search);
const lang = params.get('lang') === 'en-US' ? 'en-US' : 'zh-CN';
const zh = lang === 'zh-CN';
document.documentElement.lang = lang;
localStorage.setItem('videotracker-language', lang);
const now = Date.now();
const samples = [
  ['bilibili', 'B站', '摄影入门：光线与构图', 'Photography essentials: light and composition', 754, 1680],
  ['youtube', 'YouTube', '周末旅行日志', 'A weekend on the coast', 500, 1200],
  ['vqq', '腾讯视频', '前端开发实战', 'Frontend development workshop', 1510, 2700],
];
let records = samples.map(([platform, platformName, titleZh, titleEn, currentTime, duration], index) => ({
  id: `sample-${index}`, platform, platformName, title: zh ? titleZh : titleEn,
  url: `https://example.com/video/${index}`, episode: zh ? '示例视频' : 'Sample video',
  currentTime, duration, progress: Number(currentTime) / Number(duration),
  lastWatchedAt: now - (index + 1) * 3600000, createdAt: now - 86400000,
}));
const settings = { autoRecord: true, autoSync: false, threshold: 30, shortcut: 'Ctrl+Shift+V', siteRules: [] as SiteRule[] };
const storage: Record<string, unknown> = { theme: 'light', video_tracker_settings: settings, video_tracker_records: records };
const syncState = params.get('sync');
if (syncState === 'success' || syncState === 'error') {
  storage.video_tracker_sync_meta = { state: syncState, lastSyncAt: now, ...(syncState === 'error' ? { lastError: '示例同步失败：网络连接不可用' } : {}) };
}
const listeners = new Set<Function>();
Object.defineProperty(window, 'chrome', { configurable: true, value: {
  storage: {
    local: {
      async get(keys: string | string[]) { return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, storage[key]])); },
      async set(values: Record<string, unknown>) {
        if (syncState === 'success' || syncState === 'error') {
          if ('video_tracker_auth_meta' in values) {
            values.video_tracker_auth_meta = { isLoggedIn: true, user: { id: 'preview', email: 'preview@example.com' } };
          }
        }
        const changes = Object.fromEntries(Object.entries(values).map(([key, newValue]) => [key, {oldValue: storage[key], newValue}])); Object.assign(storage, values); listeners.forEach(fn => fn(changes, 'local'));
        if ((syncState === 'success' || syncState === 'error') && 'video_tracker_auth_meta' in values) {
          const { useAuth } = await import('../../src/options/composables/useAuth');
          await useAuth().loadAuthMeta();
        }
      },
      async remove(key: string) { delete storage[key]; },
    },
    onChanged: { addListener(fn: Function) { listeners.add(fn); }, removeListener(fn: Function) { listeners.delete(fn); } },
  },
  runtime: {
    getURL(path: string) { return path; },
    async sendMessage({type, data}: any) {
      if (type === 'GET_RECORDS' || type === 'GET_ALL_RECORDS') return {records};
      if (type === 'GET_SETTINGS') return {settings};
      if (type === 'SET_SITE_RULE') {
        settings.siteRules = [...settings.siteRules.filter(r => r.domain !== data.domain), { ...data, updatedAt: Date.now() }];
        storage.video_tracker_settings = { ...settings };
        listeners.forEach(fn => fn({ video_tracker_settings: { newValue: settings } }, 'local'));
        return { success: true, siteRules: settings.siteRules };
      }
      if (type === 'UPDATE_SETTINGS') { Object.assign(settings, data); return {success: true}; }
      if (type === 'DELETE_RECORD') { records = records.filter(r => r.id !== data.id); return {success: true}; }
      return {success: true};
    },
  },
  commands: { async getAll() { return [{ name: 'manual-save', shortcut: settings.shortcut }]; } },
  tabs: { async create() {}, async query() { return []; } },
} });
const { createApp } = await import('vue');
const {default: i18n} = await import('../../src/locales');
if (params.get('view') === 'popup') {
  document.body.innerHTML = `<main class="showcase"><section class="showcase-copy"><div class="eyebrow">VideoTracker</div><h1>${zh ? '打开记录，<br>接着上次看。' : 'Your next play.<br>Right where you left off.'}</h1><p>${zh ? '最近观看一目了然。<br>点击视频记录，回到上次进度。' : 'Your recent videos, at a glance.<br>Open a record to resume watching.'}</p><small>${zh ? '真实界面 · 示例记录' : 'Actual interface · Sample records'}</small></section><section class="popup-frame"><div id="app"></div></section></main>`;
  const {default: App} = await import('../../src/popup/App.vue');
  createApp(App).use(i18n).mount('#app');
} else {
  const {default: App} = await import('../../src/options/App.vue');
  createApp(App).use(i18n).mount('#app');
}
// Optional UI-only sync states; never connect this fixture to a real account.
const syncPreview = params.get('sync');
if (syncPreview === 'success' || syncPreview === 'error') {
  storage.video_tracker_auth_meta = { isLoggedIn: true, user: { id: 'preview', email: 'preview@example.com' } };
  storage.video_tracker_sync_meta = {
    state: syncPreview,
    lastSyncAt: now,
    ...(syncPreview === 'error' ? { lastError: '示例同步失败：网络连接不可用' } : {}),
  };
  const { useAuth } = await import('../../src/options/composables/useAuth');
  const { useSync } = await import('../../src/options/composables/useSync');
  await useAuth().loadAuthMeta();
  await useSync().loadSyncMeta();
  // Restore the synthetic identity after mounted session checks finish.
  setTimeout(() => { void useAuth().loadAuthMeta(); void useSync().loadSyncMeta(); }, 1000);
}
export {};
