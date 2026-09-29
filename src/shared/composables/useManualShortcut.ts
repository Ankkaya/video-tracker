import { onMounted, onUnmounted, ref } from 'vue';

export function useManualShortcut() {
  const shortcut = ref('');
  const status = ref<'loading' | 'assigned' | 'unassigned' | 'error'>('loading');
  const openingFailed = ref(false);
  const settingsUrl = /Edg\//.test(navigator.userAgent)
    ? 'edge://extensions/shortcuts'
    : /Firefox\//.test(navigator.userAgent) ? 'about:addons' : 'chrome://extensions/shortcuts';
  let request = 0;

  async function refresh() {
    const currentRequest = ++request;
    try {
      const commands = await chrome.commands.getAll();
      if (currentRequest !== request) return;
      const command = commands.find((entry) => entry.name === 'manual-save');
      if (!command) throw new Error('Manual-save command is unavailable');
      shortcut.value = command.shortcut?.trim() || '';
      status.value = shortcut.value ? 'assigned' : 'unassigned';
    } catch {
      if (currentRequest !== request) return;
      shortcut.value = '';
      status.value = 'error';
    }
  }

  async function openSettings() {
    openingFailed.value = false;
    try {
      await chrome.tabs.create({ url: settingsUrl });
    } catch {
      openingFailed.value = true;
    }
  }

  function onVisible() {
    if (document.visibilityState === 'visible') void refresh();
  }

  onMounted(() => {
    void refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
  });

  onUnmounted(() => {
    request++;
    window.removeEventListener('focus', refresh);
    document.removeEventListener('visibilitychange', onVisible);
  });

  return { shortcut, status, openingFailed, settingsUrl, refresh, openSettings };
}
