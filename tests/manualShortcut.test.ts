import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { useManualShortcut } from '../src/shared/composables/useManualShortcut';

let wrapper: VueWrapper | undefined;
let state: ReturnType<typeof useManualShortcut>;
const getAll = vi.fn();
const createTab = vi.fn();

async function start() {
  wrapper = mount(defineComponent({
    setup() { state = useManualShortcut(); return () => null; },
  }));
  await flushPromises();
}

beforeEach(() => {
  vi.resetAllMocks();
  getAll.mockResolvedValue([{ name: 'manual-save', shortcut: 'Ctrl+Shift+V' }]);
  createTab.mockResolvedValue({});
  vi.stubGlobal('chrome', { commands: { getAll }, tabs: { create: createTab } });
  vi.stubGlobal('navigator', { userAgent: 'Chrome/146.0' });
});

afterEach(() => {
  wrapper?.unmount();
  vi.unstubAllGlobals();
});

describe('actual browser shortcut status', () => {
  it('shows a remapped shortcut instead of the manifest suggestion', async () => {
    getAll.mockResolvedValue([{ name: 'manual-save', shortcut: 'Alt+S' }]);
    await start();
    expect(state.status.value).toBe('assigned');
    expect(state.shortcut.value).toBe('Alt+S');
  });

  it('warns when the browser leaves the shortcut unassigned', async () => {
    getAll.mockResolvedValue([{ name: 'manual-save', shortcut: '' }]);
    await start();
    expect(state.status.value).toBe('unassigned');
    expect(state.shortcut.value).toBe('');
  });

  it('distinguishes an API error from an unassigned shortcut', async () => {
    getAll.mockRejectedValue(new Error('API unavailable'));
    await start();
    expect(state.status.value).toBe('error');
  });

  it('refreshes after returning from browser settings and removes listeners on unmount', async () => {
    getAll.mockResolvedValue([{ name: 'manual-save', shortcut: '' }]);
    await start();
    getAll.mockResolvedValue([{ name: 'manual-save', shortcut: 'Ctrl+Shift+V' }]);
    window.dispatchEvent(new Event('focus'));
    await flushPromises();
    expect(state.status.value).toBe('assigned');
    wrapper!.unmount();
    wrapper = undefined;
    window.dispatchEvent(new Event('focus'));
    await flushPromises();
    expect(getAll).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['Chrome/146.0', 'chrome://extensions/shortcuts'],
    ['Chrome/146.0 Edg/146.0', 'edge://extensions/shortcuts'],
  ])('opens the correct settings page for %s', async (userAgent, url) => {
    vi.stubGlobal('navigator', { userAgent });
    await start();
    await state.openSettings();
    expect(createTab).toHaveBeenCalledWith({ url });
  });

  it('provides a manual address if opening settings fails', async () => {
    createTab.mockRejectedValue(new Error('Navigation blocked'));
    await start();
    await state.openSettings();
    expect(state.openingFailed.value).toBe(true);
    expect(state.settingsUrl).toBe('chrome://extensions/shortcuts');
  });
});
