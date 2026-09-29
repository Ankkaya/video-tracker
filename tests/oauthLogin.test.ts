import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  setSession: vi.fn(),
  getSession: vi.fn(),
  watch: vi.fn(),
  stop: vi.fn(),
  launch: vi.fn(),
  store: vi.fn(),
}));

vi.mock('../src/supabase', () => ({ supabase: { auth: mocks } }));
vi.mock('../src/shared/keyManager', () => ({ clearRememberedDataKey: vi.fn() }));
vi.mock('../src/shared/logger', () => ({ logger: { log: vi.fn(), error: vi.fn() } }));
vi.mock('../src/options/composables/authPopup', () => ({ watchAuthPopup: mocks.watch }));

import { useAuth } from '../src/options/composables/useAuth';

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('chrome', {
    identity: {
      getRedirectURL: () => 'https://extension.chromiumapp.org/',
      launchWebAuthFlow: mocks.launch,
    },
    runtime: { id: 'extension' },
    storage: { local: { set: mocks.store } },
  });
  mocks.signInWithOAuth.mockResolvedValue({ data: { url: 'https://project.supabase.co/auth/v1/authorize' }, error: null });
  mocks.watch.mockResolvedValue(mocks.stop);
  const session = { access_token: 'test-access', refresh_token: 'test-refresh', user: { id: 'test-user' } };
  mocks.setSession.mockResolvedValue({ data: { session }, error: null });
  mocks.getSession.mockResolvedValue({ data: { session } });
  mocks.launch.mockResolvedValue('https://extension.chromiumapp.org/#access_token=test-access&refresh_token=test-refresh');
});

afterEach(() => vi.unstubAllGlobals());

describe('OAuth with native popup resizing', () => {
  it('keeps the identity redirect and persists the session before reporting success', async () => {
    expect(await useAuth().signInWithOAuth('google')).toEqual({ success: true });
    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://extension.chromiumapp.org/', skipBrowserRedirect: true },
    });
    expect(mocks.stop).toHaveBeenCalledOnce();
    expect(mocks.setSession).toHaveBeenCalledWith({ access_token: 'test-access', refresh_token: 'test-refresh' });
    expect(mocks.store).toHaveBeenCalled();
  });

  it('cleans up when the user cancels without attempting to establish a session', async () => {
    mocks.launch.mockRejectedValue(new Error('The user did not approve access.'));
    expect(await useAuth().signInWithOAuth('google')).toEqual({ success: false, error: 'The user did not approve access.' });
    expect(mocks.stop).toHaveBeenCalledOnce();
    expect(mocks.setSession).not.toHaveBeenCalled();
  });

  it('allows authentication to continue if the browser cannot watch popup windows', async () => {
    mocks.watch.mockRejectedValue(new Error('Windows API unavailable'));
    expect(await useAuth().signInWithOAuth('google')).toEqual({ success: true });
    expect(mocks.launch).toHaveBeenCalledOnce();
  });

  it('returns session errors after cleaning up instead of leaving the login pending', async () => {
    mocks.setSession.mockRejectedValue(new Error('Network unavailable'));
    expect(await useAuth().signInWithOAuth('google')).toEqual({ success: false, error: 'Network unavailable' });
    expect(mocks.stop).toHaveBeenCalledOnce();
  });
});
