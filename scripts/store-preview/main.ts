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
const settings = { autoRecord: true, autoSync: false, threshold: 30, shortcut: 'Ctrl+Shift+V', customSites: [] };
const storage: Record<string, unknown> = { theme: 'light', video_tracker_settings: settings, video_tracker_records: records };
const listeners = new Set<Function>();
Object.defineProperty(window, 'chrome', { configurable: true, value: {
  storage: {
    local: {
      async get(keys: string | string[]) { return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, storage[key]])); },
      async set(values: Record<string, unknown>) { const changes = Object.fromEntries(Object.entries(values).map(([key, newValue]) => [key, {oldValue: storage[key], newValue}])); Object.assign(storage, values); listeners.forEach(fn => fn(changes, 'local')); },
      async remove(key: string) { delete storage[key]; },
    },
    onChanged: { addListener(fn: Function) { listeners.add(fn); }, removeListener(fn: Function) { listeners.delete(fn); } },
  },
  runtime: {
    getURL(path: string) { return path; },
    async sendMessage({type, data}: any) {
      if (type === 'GET_RECORDS' || type === 'GET_ALL_RECORDS') return {records};
      if (type === 'GET_SETTINGS') return {settings};
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
