import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { MSG, STORAGE_KEYS, DEFAULT_SETTINGS } from '../src/shared/constants';
vi.mock('../src/shared/logger', () => ({ logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

let settings: any;
let changed: (changes: any, area: string) => void;
let messageListener: (message: any, sender: any, respond: any) => void;
let sendMessage: ReturnType<typeof vi.fn>;
const originalPush = history.pushState;
const originalReplace = history.replaceState;
async function flush() { for (let i = 0; i < 15; i++) await Promise.resolve(); }
beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  settings = { ...DEFAULT_SETTINGS, autoRecord: true, siteRules: [] };
  document.body.innerHTML = '<video></video>';
  const video = document.querySelector('video')!;
  Object.defineProperties(video, {
    duration: { configurable: true, value: 100 },
    currentTime: { configurable: true, value: 10 },
    paused: { configurable: true, value: false },
  });
  sendMessage = vi.fn(async (message: any) => message.type === MSG.GET_SETTINGS ? { settings, pageUrl: 'https://example.com/watch' } : { success: true });
  vi.stubGlobal('defineContentScript', (config: any) => config);
  vi.stubGlobal('chrome', {
    runtime: { id: 'test', sendMessage, onMessage: { addListener: (fn: typeof messageListener) => { messageListener = fn; } } },
    storage: { onChanged: { addListener: (fn: typeof changed) => { changed = fn; } } },
  });
  const { default: script } = await import('../entrypoints/content');
  script.main({} as any);
  await flush();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  history.pushState = originalPush;
  history.replaceState = originalReplace;
  document.body.innerHTML = '';
});
const heartbeats = () => sendMessage.mock.calls.filter(([m]) => m.type === MSG.HEARTBEAT);
describe('generic content detection', () => {
  it('manually saves cross-origin iframe progress while automatic recording is disabled', async () => {
    document.body.innerHTML = '<iframe></iframe>';
    settings = { ...settings, autoRecord: false };
    sendMessage.mockImplementation(async (message: any) => {
      if (message.type === MSG.GET_SETTINGS) return { settings, pageUrl: 'https://example.com/watch' };
      if (message.type === MSG.PROBE_IFRAME_VIDEO) return {
        success: true, frameId: 2,
        videoData: { currentTime: 42, duration: 100, paused: false },
      };
      return { success: true };
    });
    changed({ [STORAGE_KEYS.SETTINGS]: { newValue: settings } }, 'local');
    await flush();
    messageListener({ type: MSG.MANUAL_SAVE_REQUEST }, {}, () => {});
    await flush();
    const saves = sendMessage.mock.calls.filter(([m]) => m.type === MSG.MANUAL_SAVE);
    expect(saves).toHaveLength(1);
    expect(saves[0][0].data).toMatchObject({
      currentTime: 42, duration: 100, platform: 'generic',
      url: location.origin + location.pathname + location.search,
    });
    expect(heartbeats()).toHaveLength(0);
  });
  it('uses generic detection on a site without any custom registration', async () => {
    await vi.advanceTimersByTimeAsync(5000);
    expect(heartbeats()).toHaveLength(1);
    expect(heartbeats()[0][0].data.platform).toBe('generic');
  });
  it('stops immediately when disabled, permits manual save, and restarts when enabled', async () => {
    settings = { ...settings, siteRules: [{ domain: 'example.com', autoRecord: false, updatedAt: 1 }] };
    changed({ [STORAGE_KEYS.SETTINGS]: { newValue: settings } }, 'local');
    await flush();
    await vi.advanceTimersByTimeAsync(5000);
    expect(heartbeats()).toHaveLength(0);
    messageListener({ type: MSG.MANUAL_SAVE_REQUEST }, {}, () => {});
    await flush();
    expect(sendMessage.mock.calls.some(([m]) => m.type === MSG.MANUAL_SAVE)).toBe(true);
    settings = { ...settings, siteRules: [{ domain: 'example.com', autoRecord: true, updatedAt: 2 }] };
    changed({ [STORAGE_KEYS.SETTINGS]: { newValue: settings } }, 'local');
    await flush();
    await vi.advanceTimersByTimeAsync(5000);
    expect(heartbeats()).toHaveLength(1);
  });
});

