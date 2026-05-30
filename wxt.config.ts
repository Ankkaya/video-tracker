import { defineConfig } from 'wxt';
import UnoCSS from 'unocss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  vite: () => ({
    plugins: [UnoCSS()],
  }),
  manifest: {
    name: 'VideoTracker',
    description: 'Automatically save and resume your watch progress across video sites',
    version: '0.0.3',
    permissions: ['storage', 'activeTab', 'tabs', 'commands', 'scripting', 'identity'],
    host_permissions: ['*://*/*'],
    icons: {
      16: 'icon-16.png',
      32: 'icon-32.png',
      48: 'icon-48.png',
      128: 'icon-128.png',
    },
    action: {
      default_popup: 'popup.html',
      default_icon: {
        16: 'icon-16.png',
        32: 'icon-32.png',
        48: 'icon-48.png',
        128: 'icon-128.png',
      },
    },
    options_page: 'options.html',
    options_ui: {
      page: 'options.html',
      open_in_tab: true,
    },
    commands: {
      'manual-save': {
        suggested_key: {
          default: 'Ctrl+Shift+V',
          mac: 'Command+Shift+V',
        },
        description: 'Manually save current video record',
      },
    },
  },
});
