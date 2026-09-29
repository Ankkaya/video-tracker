const POPUP_WIDTH = 1200;
const POPUP_HEIGHT = 820;

/** Resize the native identity popup without replacing Chrome's OAuth handling. */
export async function watchAuthPopup(authUrl: string, provider: 'google' | 'github') {
  const authorizationUrl = new URL(authUrl);
  const callbackUrl = new URL('/auth/v1/callback', authorizationUrl).href;
  const providerOrigin = provider === 'google' ? 'https://accounts.google.com' : 'https://github.com';
  const existingWindows = new Set((await chrome.windows.getAll()).map((window) => window.id));
  const width = Math.min(POPUP_WIDTH, screen.availWidth || POPUP_WIDTH);
  const height = Math.min(POPUP_HEIGHT, screen.availHeight || POPUP_HEIGHT);
  // availLeft/availTop preserve the current monitor's origin on multi-screen setups.
  const display = screen as Screen & { availLeft?: number; availTop?: number };
  const left = Math.round((display.availLeft ?? 0) + ((screen.availWidth || width) - width) / 2);
  const top = Math.round((display.availTop ?? 0) + ((screen.availHeight || height) - height) / 2);
  let stopped = false;
  let resizing = false;

  function isAuthUrl(value?: string): boolean {
    if (!value) return false;
    try {
      let url = new URL(value);
      if (url.origin === authorizationUrl.origin && url.pathname === authorizationUrl.pathname) {
        return url.searchParams.get('provider') === provider
          && url.searchParams.get('redirect_to') === authorizationUrl.searchParams.get('redirect_to');
      }
      // Google may wrap the OAuth URL in a "continue" parameter on its sign-in page.
      for (let depth = 0; depth < 4 && url.origin === providerOrigin; depth++) {
        if (url.searchParams.get('redirect_uri') === callbackUrl) return true;
        const next = url.searchParams.get('continue');
        if (!next) break;
        url = new URL(next, url);
      }
    } catch {
      // Ignore non-URL and unrelated browser tabs.
    }
    return false;
  }

  async function inspect(tab: chrome.tabs.Tab) {
    if (stopped || resizing || existingWindows.has(tab.windowId)
      || ![tab.url, tab.pendingUrl].some(isAuthUrl)) return;
    resizing = true;
    try {
      const popup = await chrome.windows.get(tab.windowId);
      if (stopped || popup.type !== 'popup') return;
      await chrome.windows.update(tab.windowId, { width, height, left, top, state: 'normal' });
      stop();
    } catch {
      // The user may close the popup before it can be resized. Authentication
      // still completes or reports cancellation through the identity API.
    } finally {
      resizing = false;
    }
  }

  function onTabCreated(tab: chrome.tabs.Tab) {
    void inspect(tab);
  }

  function onTabUpdated(_id: number, _change: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) {
    void inspect(tab);
  }

  function onWindowCreated(window: chrome.windows.Window) {
    if (window.type !== 'popup' || window.id === undefined) return;
    // Window creation can precede tab insertion; tab events cover that race.
    void chrome.tabs.query({ windowId: window.id }).then((tabs) => {
      for (const tab of tabs) void inspect(tab);
    }).catch(() => {});
  }

  function stop() {
    stopped = true;
    chrome.tabs.onCreated.removeListener(onTabCreated);
    chrome.tabs.onUpdated.removeListener(onTabUpdated);
    chrome.windows.onCreated.removeListener(onWindowCreated);
  }

  chrome.tabs.onCreated.addListener(onTabCreated);
  chrome.tabs.onUpdated.addListener(onTabUpdated);
  chrome.windows.onCreated.addListener(onWindowCreated);
  return stop;
}
