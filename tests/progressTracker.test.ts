import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ProgressTracker } from '../src/shared/progressTracker';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../src/shared/constants';
import type { VideoInfo, WatchRecord } from '../src/shared/types';
import { isRecordCompleted } from '../src/shared/watchStatus';

let state: Record<string, any>;
let tracker: ProgressTracker;
let writes: ReturnType<typeof vi.fn<(values: unknown) => void>>;
const video: VideoInfo = { url: 'https://www.youtube.com/watch?v=abc', platform: 'youtube', platformName: 'YouTube',
  title: 'Video', episode: '正片', currentTime: 10, duration: 100, isPlaying: true };
const history = (overrides: Partial<WatchRecord> = {}): WatchRecord => ({ ...video, id: 'saved', progress: .1,
  createdAt: 1, lastWatchedAt: 1, notes: 'Keep this', ...overrides });
const records = () => state[STORAGE_KEYS.RECORDS] as WatchRecord[];
async function tick(seconds: number, time: number) {
  vi.setSystemTime(Date.now() + seconds * 1000);
  await tracker.report({ ...video, currentTime: time }, '1:0');
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(100000);
  state = { [STORAGE_KEYS.SETTINGS]: { ...DEFAULT_SETTINGS, autoRecord: false, threshold: 30 }, [STORAGE_KEYS.RECORDS]: [history()] };
  writes = vi.fn();
  vi.stubGlobal('chrome', { storage: { local: {
    get: async (key: string) => ({ [key]: structuredClone(state[key]) }),
    set: async (values: any) => { writes(values); Object.assign(state, structuredClone(values)); },
  } } });
  tracker = new ProgressTracker(vi.fn());
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('progress persistence', () => {
  it('tracks saved videos with auto-record off, writes at 30 seconds, and preserves notes and IDs', async () => {
    expect((await tracker.match(video)).record?.id).toBe('saved');
    await tracker.report(video, '1:0');
    for (let time = 15; time <= 35; time += 5) await tick(5, time);
    expect(writes).not.toHaveBeenCalled();
    await tick(5, 40);
    expect(writes).toHaveBeenCalledTimes(1);
    expect(records()[0]).toMatchObject({ id: 'saved', currentTime: 40, notes: 'Keep this' });
  });

  it('immediately persists pause and ended, and deduplicates unchanged events', async () => {
    await tracker.report(video, '1:0');
    await tracker.report({ ...video, currentTime: 42, event: 'pause', isPlaying: false }, '1:0');
    expect(records()[0].currentTime).toBe(42);
    const count = writes.mock.calls.length;
    await tracker.report({ ...video, currentTime: 42, event: 'pause', isPlaying: false }, '1:0');
    expect(writes).toHaveBeenCalledTimes(count);
    await tracker.report({ ...video, currentTime: 100, event: 'ended', isPlaying: false }, '1:0');
    expect(records()[0]).toMatchObject({ currentTime: 100, completed: true });
  });

  it('only adds new videos when enabled and after actual playing time reaches the threshold', async () => {
    state[STORAGE_KEYS.RECORDS] = [];
    await tracker.report(video, '1:0');
    await tick(60, 70);
    expect(records()).toEqual([]);
    state[STORAGE_KEYS.SETTINGS].autoRecord = true;
    state[STORAGE_KEYS.SETTINGS].threshold = 10;
    await tracker.report(video, '1:0');
    await tick(5, 15);
    expect(records()).toEqual([]);
    await tracker.report({ ...video, currentTime: 15, event: 'pause', isPlaying: false }, '1:0');
    vi.setSystemTime(Date.now() + 60000);
    await tracker.report({ ...video, currentTime: 90, event: 'seeked', isPlaying: false }, '1:0');
    expect(records()).toEqual([]);
    await tracker.report({ ...video, currentTime: 90, event: 'play', isPlaying: true }, '1:0');
    await tick(5, 95);
    expect(records()).toHaveLength(1);
  });

  it('saves the old video on switch without creating an unrecorded next video when disabled', async () => {
    await tracker.report({ ...video, currentTime: 25 }, '1:0');
    await tracker.report({ ...video, url: 'https://youtube.com/watch?v=next', currentTime: 1 }, '1:0');
    expect(records()).toHaveLength(1);
    expect(records()[0].currentTime).toBe(25);
  });

  it('updates a paused saved video immediately after a service worker restart', async () => {
    await tracker.report({ ...video, currentTime: 100, event: 'ended', isPlaying: false }, '1:0');
    expect(records()[0].completed).toBe(true);
  });

  it('manual completion preserves progress and can be reversed without auto-completing on pause', async () => {
    await tracker.setCompleted('saved', true);
    expect(records()[0]).toMatchObject({ completed: true, currentTime: 10 });
    await tracker.setCompleted('saved', false);
    await tracker.report({ ...video, currentTime: 99, event: 'pause', isPlaying: false }, '1:0');
    expect(isRecordCompleted(records()[0])).toBe(false);
    await tracker.report({ ...video, currentTime: 100, event: 'ended', isPlaying: false }, '1:0');
    expect(records()[0].completed).toBe(true);
  });

  it('keeps manual completion during playback and resets it only when playback restarts earlier', async () => {
    await tracker.setCompleted('saved', true);
    await tracker.report(video, '1:0');
    await tick(30, 40);
    expect(records()[0].completed).toBe(true);
    await tracker.report({ ...video, currentTime: 0, event: 'play' }, '1:0');
    await tracker.report({ ...video, currentTime: 1, event: 'pause', isPlaying: false }, '1:0');
    expect(records()[0].completed).toBe(false);
  });

  it('does not resurrect an active record after it is deleted', async () => {
    state[STORAGE_KEYS.SETTINGS].autoRecord = true;
    state[STORAGE_KEYS.SETTINGS].threshold = 0;
    await tracker.report(video, '1:0');
    state[STORAGE_KEYS.RECORDS] = [];
    await tick(30, 40);
    await tracker.flush('1:0');
    expect(records()).toEqual([]);
  });

  it('keeps invalid or unknown-duration streams out of automatic history', async () => {
    state[STORAGE_KEYS.RECORDS] = [];
    state[STORAGE_KEYS.SETTINGS].autoRecord = true;
    state[STORAGE_KEYS.SETTINGS].threshold = 0;
    await tracker.report({ ...video, duration: Infinity }, '1:0');
    await tracker.report({ ...video, duration: 0 }, '1:0');
    expect(records()).toEqual([]);
  });

  it('does not count buffering or a seek jump toward the recording threshold', async () => {
    state[STORAGE_KEYS.RECORDS] = [];
    state[STORAGE_KEYS.SETTINGS] = { ...DEFAULT_SETTINGS, autoRecord: true, threshold: 10 };
    await tracker.report(video, '1:0');
    for (let count = 0; count < 6; count++) await tick(5, 10);
    expect(records()).toEqual([]);
    await tracker.report({ ...video, currentTime: 90, event: 'seeked' }, '1:0');
    expect(records()).toEqual([]);
    await tick(5, 95);
    expect(records()).toEqual([]);
    await tick(5, 100);
    expect(records()).toHaveLength(1);
  });

  it('counts the final playing interval and saves the snapshot immediately on switch', async () => {
    state[STORAGE_KEYS.RECORDS] = [];
    state[STORAGE_KEYS.SETTINGS] = { ...DEFAULT_SETTINGS, autoRecord: true, threshold: 5 };
    await tracker.report(video, '1:0');
    vi.setSystemTime(Date.now() + 5000);
    await tracker.flush('1:0', { ...video, currentTime: 15, event: 'switch' });
    expect(records()).toHaveLength(1);
    expect(records()[0].currentTime).toBe(15);
  });

  it('clears a pending new video on disable without affecting already saved sessions', async () => {
    state[STORAGE_KEYS.RECORDS] = [];
    state[STORAGE_KEYS.SETTINGS] = { ...DEFAULT_SETTINGS, autoRecord: true, threshold: 10 };
    await tracker.report(video, '1:0');
    await tick(5, 15);
    tracker.settingsChanged({ ...state[STORAGE_KEYS.SETTINGS], autoRecord: false });
    await tracker.report({ ...video, event: 'play' }, '1:0');
    await tick(5, 15);
    expect(records()).toEqual([]);
    await tick(5, 20);
    expect(records()).toHaveLength(1);
  });
});
