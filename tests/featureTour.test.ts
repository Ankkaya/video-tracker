import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { useFeatureTour } from '../src/options/composables/useFeatureTour';
import { MSG, STORAGE_KEYS } from '../src/shared/constants';

let wrapper: VueWrapper | undefined;
let tour: ReturnType<typeof useFeatureTour>;
let storage: Record<string, any>;
let listeners: Set<(changes: any, area: string) => void>;
const navigate = vi.fn();
const set = vi.fn();
const sendMessage = vi.fn();
async function start(autoStart = true) {
  wrapper = mount(defineComponent({ setup() { tour = useFeatureTour(navigate, autoStart); return () => null; } }));
  await flushPromises();
}
beforeEach(() => {
  vi.resetAllMocks();
  storage = {};
  listeners = new Set();
  sendMessage.mockResolvedValue({ records: [] });
  set.mockImplementation(async (values: any) => {
    Object.assign(storage, values);
    listeners.forEach(fn => fn(Object.fromEntries(Object.entries(values).map(([key, newValue]) => [key, { newValue }])), 'local'));
  });
  vi.stubGlobal('chrome', {
    runtime: { sendMessage },
    storage: { local: {
      get: async (keys: string[]) => Object.fromEntries(keys.map(key => [key, storage[key]])), set,
    }, onChanged: { addListener: (fn: any) => listeners.add(fn), removeListener: (fn: any) => listeners.delete(fn) } },
  });
});
afterEach(() => { wrapper?.unmount(); wrapper = undefined; vi.unstubAllGlobals(); });

describe('feature tour navigation and persistence', () => {
  it('walks through records, switch, watch time and shortcut, then returns to records', async () => {
    await start();
    expect(tour.open.value).toBe(true);
    expect(navigate).toHaveBeenLastCalledWith('records');
    for (const step of [1, 2, 3]) {
      await tour.next();
      expect(tour.step.value).toBe(step);
      expect(navigate).toHaveBeenLastCalledWith('settings');
      expect(storage[STORAGE_KEYS.FEATURE_TOUR]).toEqual({ step, status: 'active' });
    }
    await tour.next();
    expect(tour.open.value).toBe(false);
    expect(navigate).toHaveBeenLastCalledWith('records');
    expect(storage[STORAGE_KEYS.FEATURE_TOUR].status).toBe('completed');
    expect(sendMessage).toHaveBeenCalledWith({ type: MSG.GET_ALL_RECORDS });
    expect(sendMessage.mock.calls.some(([m]) => m.type === MSG.UPDATE_SETTINGS)).toBe(false);
  });

  it('resumes the saved step after reopening and supports back navigation', async () => {
    storage[STORAGE_KEYS.FEATURE_TOUR] = { step: 2, status: 'active' };
    await start();
    expect(tour.step.value).toBe(2);
    expect(navigate).toHaveBeenLastCalledWith('settings');
    await tour.previous();
    expect(tour.step.value).toBe(1);
    await tour.previous();
    expect(navigate).toHaveBeenLastCalledWith('records');
  });

  it.each(['completed', 'skipped'])('does not automatically replay a %s tour, but allows explicit restart', async status => {
    storage[STORAGE_KEYS.FEATURE_TOUR] = { step: 3, status };
    await start();
    expect(tour.open.value).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    await tour.start();
    expect(tour.open.value).toBe(true);
    expect(tour.step.value).toBe(0);
    await tour.skip();
    expect(tour.open.value).toBe(false);
    expect(storage[STORAGE_KEYS.FEATURE_TOUR].status).toBe('skipped');
  });

  it('does not interrupt an existing user or an explicitly requested login/settings page', async () => {
    sendMessage.mockResolvedValue({ records: [{ id: 'existing' }] });
    await start();
    expect(tour.open.value).toBe(false);
    wrapper!.unmount();
    storage[STORAGE_KEYS.FEATURE_TOUR] = { step: 2, status: 'active' };
    await start(false);
    expect(tour.open.value).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    await tour.start();
    expect(navigate).toHaveBeenLastCalledWith('records');
  });

  it('keeps the current step and displays an error when persistence fails', async () => {
    await start();
    set.mockRejectedValueOnce(new Error('Storage failed'));
    await tour.next();
    expect(tour.step.value).toBe(0);
    expect(tour.failed.value).toBe(true);
    expect(tour.open.value).toBe(true);
    await tour.next();
    expect(tour.step.value).toBe(1);
    expect(tour.failed.value).toBe(false);
  });

  it('closes when another extension page completes the tour and removes its listener', async () => {
    await start();
    await set({ [STORAGE_KEYS.FEATURE_TOUR]: { step: 3, status: 'completed' } });
    expect(tour.open.value).toBe(false);
    wrapper!.unmount();
    expect(listeners.size).toBe(0);
  });
});
