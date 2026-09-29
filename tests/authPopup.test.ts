import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchAuthPopup } from '../src/options/composables/authPopup';

function event() {
  const listeners = new Set<(...args: any[]) => void>();
  return {
    addListener: vi.fn((listener) => listeners.add(listener)),
    removeListener: vi.fn((listener) => listeners.delete(listener)),
    emit: (...args: any[]) => { for (const listener of listeners) listener(...args); },
    listeners,
  };
}

const authUrl = 'https://project.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fextension.chromiumapp.org%2F';
const googleUrl = 'https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=https%3A%2F%2Fproject.supabase.co%2Fauth%2Fv1%2Fcallback';
let api: ReturnType<typeof createApi>;
let stop: (() => void) | undefined;

function createApi() {
  return {
    windows: {
      getAll: vi.fn().mockResolvedValue([{ id: 1 }]),
      get: vi.fn().mockResolvedValue({ id: 2, type: 'popup' }),
      update: vi.fn().mockResolvedValue({}),
      onCreated: event(),
    },
    tabs: {
      onCreated: event(),
      onUpdated: event(),
      query: vi.fn().mockResolvedValue([]),
    },
  };
}

async function flush() {
  // Drain browser API promise continuations, without real delays.
  for (let i = 0; i < 6; i++) await Promise.resolve();
}

beforeEach(() => {
  api = createApi();
  vi.stubGlobal('chrome', api);
  vi.stubGlobal('screen', { availWidth: 1920, availHeight: 1080, availLeft: 0, availTop: 0 });
});

afterEach(() => {
  stop?.();
  stop = undefined;
  vi.unstubAllGlobals();
});

describe('native OAuth popup sizing', () => {
  it('centers the matching new popup and detaches after resizing once', async () => {
    stop = await watchAuthPopup(authUrl, 'google');
    api.tabs.onCreated.emit({ id: 20, windowId: 2, url: googleUrl });
    await flush();
    expect(api.windows.update).toHaveBeenCalledWith(2, {
      width: 1200, height: 820, left: 360, top: 130, state: 'normal',
    });
    expect(api.tabs.onCreated.listeners.size).toBe(0);
    expect(api.tabs.onUpdated.listeners.size).toBe(0);
    expect(api.windows.onCreated.listeners.size).toBe(0);
  });

  it('handles window creation before tab insertion and nested Google redirects', async () => {
    stop = await watchAuthPopup(authUrl, 'google');
    api.windows.onCreated.emit({ id: 2, type: 'popup' });
    await flush();
    expect(api.windows.update).not.toHaveBeenCalled();
    const pendingUrl = `https://accounts.google.com/v3/signin/identifier?continue=${encodeURIComponent(googleUrl)}`;
    api.tabs.onUpdated.emit(20, { status: 'loading' }, { id: 20, windowId: 2, pendingUrl });
    await flush();
    expect(api.windows.update).toHaveBeenCalledOnce();
  });

  it('also discovers an already populated new popup', async () => {
    api.tabs.query.mockResolvedValue([{ id: 20, windowId: 2, url: authUrl }]);
    stop = await watchAuthPopup(authUrl, 'google');
    api.windows.onCreated.emit({ id: 2, type: 'popup' });
    await flush();
    expect(api.windows.update).toHaveBeenCalledOnce();
  });

  it('does not change existing windows, unrelated providers, or other projects', async () => {
    stop = await watchAuthPopup(authUrl, 'google');
    for (const tab of [
      { windowId: 1, url: googleUrl },
      { windowId: 2, url: googleUrl.replace('accounts.google.com', 'example.com') },
      { windowId: 2, url: googleUrl.replace('project.supabase.co', 'other.supabase.co') },
      { windowId: 2, url: authUrl.replace('extension.chromiumapp.org', 'other.chromiumapp.org') },
    ]) api.tabs.onCreated.emit(tab);
    await flush();
    expect(api.windows.get).not.toHaveBeenCalled();
    expect(api.windows.update).not.toHaveBeenCalled();
  });

  it('does not resize a regular browser window', async () => {
    api.windows.get.mockResolvedValue({ id: 2, type: 'normal' });
    stop = await watchAuthPopup(authUrl, 'google');
    api.tabs.onCreated.emit({ windowId: 2, url: googleUrl });
    await flush();
    expect(api.windows.update).not.toHaveBeenCalled();
  });

  it('fits small displays and respects a monitor with a negative origin', async () => {
    vi.stubGlobal('screen', { availWidth: 480, availHeight: 600, availLeft: -480, availTop: 40 });
    stop = await watchAuthPopup(authUrl, 'google');
    api.tabs.onCreated.emit({ windowId: 2, url: googleUrl });
    await flush();
    expect(api.windows.update).toHaveBeenCalledWith(2, {
      width: 480, height: 600, left: -480, top: 40, state: 'normal',
    });
  });

  it('does not resize after the OAuth flow ends during window lookup', async () => {
    let complete!: (value: object) => void;
    api.windows.get.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    stop = await watchAuthPopup(authUrl, 'google');
    api.tabs.onCreated.emit({ windowId: 2, url: googleUrl });
    stop();
    complete({ id: 2, type: 'popup' });
    await flush();
    expect(api.windows.update).not.toHaveBeenCalled();
  });

  it('tolerates closing the window before resize', async () => {
    api.windows.update.mockRejectedValue(new Error('Window not found'));
    stop = await watchAuthPopup(authUrl, 'google');
    api.tabs.onCreated.emit({ windowId: 2, url: googleUrl });
    await flush();
    stop();
    expect(api.tabs.onCreated.listeners.size).toBe(0);
    expect(api.tabs.onUpdated.listeners.size).toBe(0);
  });
});
