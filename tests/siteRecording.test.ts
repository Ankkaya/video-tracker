import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { MSG, STORAGE_KEYS, DEFAULT_SETTINGS } from '../src/shared/constants';

vi.mock('../src/supabase', () => ({ supabase: null }));
vi.mock('../src/shared/keyManager', () => ({ restoreRememberedDataKey: async () => false }));
vi.mock('../src/shared/encryptedSync', () => ({ syncEncryptedData: vi.fn() }));
vi.mock('../src/shared/logger', () => ({ logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

let storage: Record<string, any>;
let listener: (message: any, sender: any, respond: (response: any) => void) => unknown;
let changed: (changes: any, area: string) => void;
const sender = { tab: { id: 1, url: 'https://example.com/watch', title: 'Top page title' }, frameId: 2 };
const video = { url: 'https://cdn.test/player', title: 'Frame title', episode: '正片', platform: 'generic', platformName: '通用', currentTime: 10, duration: 100 };
async function send(type: string, data: any, from = sender) {
  listener({ type, data }, from, () => {});
  // Routes acknowledge heartbeat immediately; let all storage awaits finish.
  for (let i = 0; i < 30; i++) await Promise.resolve();
}

beforeEach(async () => {
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
    runtime: { onMessage: { addListener: (fn: typeof listener) => { listener = fn; } } },
    action: { setIcon: vi.fn(), setBadgeText: vi.fn(), setTitle: vi.fn() },
    tabs: { sendMessage: async () => {} },
  });
  const { default: start } = await import('../entrypoints/background');
  (start as unknown as () => void)();
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('background site recording integration', () => {
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
  it('does not create records for seek-only reports or live streams', async () => {
    await send(MSG.HEARTBEAT, { ...video, isPlaying: false });
    await send(MSG.HEARTBEAT, { ...video, duration: Infinity });
    expect(storage[STORAGE_KEYS.RECORDS]).toBeUndefined();
  });
});

