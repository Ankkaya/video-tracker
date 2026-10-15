import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { MSG, STORAGE_KEYS, DEFAULT_SETTINGS } from '../src/shared/constants';

vi.mock('../src/supabase', () => ({ supabase: null }));
vi.mock('../src/shared/keyManager', () => ({ restoreRememberedDataKey: async () => false }));
vi.mock('../src/shared/encryptedSync', () => ({ syncEncryptedData: vi.fn() }));
vi.mock('../src/shared/logger', () => ({ logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

let storage: Record<string, any>;
let listener: (message: any, sender: any, respond: (response: any) => void) => unknown;
let changed: (changes: any, area: string) => void;
let installed: (details: any) => void;
const createTab = vi.fn(async () => ({}));
const sender = { tab: { id: 1, url: 'https://example.com/watch', title: 'Top page title' }, frameId: 2 };
const video = { url: 'https://cdn.test/player', title: 'Frame title', episode: '正片', platform: 'generic', platformName: '通用', currentTime: 10, duration: 100 };
async function send(type: string, data: any, from = sender) {
  listener({ type, data }, from, () => {});
  // Routes acknowledge heartbeat immediately; let all storage awaits finish.
  for (let i = 0; i < 30; i++) await Promise.resolve();
}

beforeEach(async () => {
  createTab.mockClear();
  vi.resetModules();
  storage = { [STORAGE_KEYS.SETTINGS]: { ...DEFAULT_SETTINGS, autoRecord: true, threshold: 0, siteRules: [] } };
  vi.stubGlobal('defineBackground', (init: () => void) => init);
  vi.stubGlobal('chrome', {
    storage: { local: {
      get: async (key: string) => ({ [key]: structuredClone(storage[key]) }),
      set: async (values: any) => {
        const changes = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { oldValue: storage[key], newValue: value }]));
        Object.assign(storage, values);
        changed?.(changes, 'local');
      },
    }, onChanged: { addListener: (fn: typeof changed) => { changed = fn; } } },
    runtime: {
      getURL: (path: string) => `chrome-extension://test${path}`,
      onInstalled: { addListener: (fn: typeof installed) => { installed = fn; } },
      onMessage: { addListener: (fn: typeof listener) => { listener = fn; } },
    },
    action: { setIcon: vi.fn(), setBadgeText: vi.fn(), setTitle: vi.fn() },
    tabs: { sendMessage: async () => {}, create: createTab },
  });
  const { default: start } = await import('../entrypoints/background');
  (start as unknown as () => void)();
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('background site recording integration', () => {
  it('persists manual completion through the real options API and background reply', async () => {
    const { api } = await import('../src/options/composables/useApi');
    const from = { url: 'chrome-extension://test/options.html' };
    chrome.runtime.sendMessage = vi.fn((message: any) => new Promise(resolve => {
      expect(listener(message, from, resolve)).toBe(true);
    })) as typeof chrome.runtime.sendMessage;
    await send(MSG.MANUAL_SAVE, video);
    const saved = structuredClone(storage[STORAGE_KEYS.RECORDS][0]);
    const completed = await api.setCompleted(saved.id, true);
    expect(completed).toMatchObject({ id: saved.id, completed: true, completionSource: 'manual', currentTime: saved.currentTime, duration: saved.duration, progress: saved.progress });
    expect(storage[STORAGE_KEYS.RECORDS][0]).toEqual(completed);
    const unfinished = await api.setCompleted(saved.id, false);
    expect(unfinished).toMatchObject({ id: saved.id, completed: false, currentTime: saved.currentTime, progress: saved.progress });
    expect(storage[STORAGE_KEYS.RECORDS][0]).toEqual(unfinished);
    await expect(api.setCompleted('removed-record', true)).rejects.toThrow('Record not found');
    expect(storage[STORAGE_KEYS.RECORDS]).toHaveLength(1);
  });

  it('returns storage failures instead of reporting success or changing the saved state', async () => {
    await send(MSG.MANUAL_SAVE, video);
    const saved = structuredClone(storage[STORAGE_KEYS.RECORDS][0]);
    vi.spyOn(chrome.storage.local, 'set').mockRejectedValueOnce(new Error('QUOTA_BYTES quota exceeded'));
    const response = await new Promise(resolve => {
      expect(listener({ type: MSG.SET_RECORD_COMPLETED, data: { id: saved.id, completed: true } }, {}, resolve)).toBe(true);
    });
    expect(response).toEqual({ success: false, error: 'QUOTA_BYTES quota exceeded' });
    expect(storage[STORAGE_KEYS.RECORDS][0]).toEqual(saved);
  });

  it('opens getting started on installation and does not reopen it on update', async () => {
    installed({ reason: 'update' });
    await Promise.resolve();
    expect(createTab).not.toHaveBeenCalled();
    installed({ reason: 'install' });
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(createTab).toHaveBeenCalledWith({ url: 'chrome-extension://test/options.html' });
    expect(storage[STORAGE_KEYS.FEATURE_TOUR]).toEqual({ step: 0, status: 'active' });
  });
  it('automatically saves an unconfigured site and attributes nested frames to the tab', async () => {
    await send(MSG.HEARTBEAT, video);
    expect(storage[STORAGE_KEYS.RECORDS]).toHaveLength(1);
    expect(storage[STORAGE_KEYS.RECORDS][0]).toMatchObject({ url: sender.tab.url, title: sender.tab.title, platformName: 'example.com' });
  });
  it('blocks frame heartbeats on a disabled top-level site but allows manual saving', async () => {
    storage[STORAGE_KEYS.SETTINGS].siteRules = [{ domain: 'example.com', autoRecord: false, updatedAt: 1 }];
    await send(MSG.HEARTBEAT, video);
    expect(storage[STORAGE_KEYS.RECORDS]).toBeUndefined();
    await send(MSG.MANUAL_SAVE, video);
    expect(storage[STORAGE_KEYS.RECORDS]).toHaveLength(1);
  });
  it('does not save pending progress on unload after the site is disabled', async () => {
    storage[STORAGE_KEYS.SETTINGS].threshold = 30;
    await send(MSG.HEARTBEAT, video);
    await send(MSG.SET_SITE_RULE, { domain: 'example.com', autoRecord: false });
    storage[STORAGE_KEYS.SETTINGS].threshold = 0;
    await send(MSG.PAGE_UNLOAD, { url: video.url });
    expect(storage[STORAGE_KEYS.RECORDS]).toBeUndefined();
  });
  it('site exclusions only stop new records; existing progress continues to update', async () => {
    const builtinSender = { tab: { id: 2, url: 'https://www.bilibili.com/video/BV123', title: 'Bilibili video' }, frameId: 0 };
    const builtinVideo = { ...video, url: builtinSender.tab.url, platform: 'bilibili', platformName: 'B站' };
    await send(MSG.HEARTBEAT, builtinVideo, builtinSender);
    const saved = structuredClone(storage[STORAGE_KEYS.RECORDS][0]);

    await send(MSG.SET_SITE_RULE, { domain: 'bilibili.com', autoRecord: false });
    await send(MSG.HEARTBEAT, { ...builtinVideo, currentTime: 50 }, builtinSender);
    await send(MSG.PAGE_UNLOAD, { url: builtinVideo.url }, builtinSender);
    expect(storage[STORAGE_KEYS.RECORDS][0]).toMatchObject({ id: saved.id, currentTime: 50 });

    await send(MSG.HEARTBEAT, video);
    expect(storage[STORAGE_KEYS.RECORDS]).toHaveLength(2);

    await send(MSG.SET_SITE_RULE, { domain: 'bilibili.com', autoRecord: true });
    await send(MSG.HEARTBEAT, { ...builtinVideo, currentTime: 60 }, builtinSender);
    await send(MSG.PAGE_UNLOAD, { url: builtinVideo.url }, builtinSender);
    expect(storage[STORAGE_KEYS.RECORDS]).toHaveLength(2);
    expect(storage[STORAGE_KEYS.RECORDS].find((record: any) => record.url === builtinVideo.url))
      .toMatchObject({ id: saved.id, currentTime: 60 });
  });
  it('does not create records for seek-only reports or live streams', async () => {
    await send(MSG.HEARTBEAT, { ...video, isPlaying: false });
    await send(MSG.HEARTBEAT, { ...video, duration: Infinity });
    expect(storage[STORAGE_KEYS.RECORDS]).toBeUndefined();
  });
});

