import { defineConfig } from 'wxt';
import UnoCSS from 'unocss/vite';
import { loadEnv } from 'vite';

const env = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');
const extensionKey = env.WXT_EXTENSION_KEY;

// 只在开发环境包含 key，生产构建不包含（商店不允许 key 字段）
const isDevelopment = process.env.NODE_ENV !== 'production';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  vite: () => ({
    plugins: [UnoCSS()],
  }),
  manifest: {
    name: 'VideoTracker',
    description: 'Automatically save and resume your watch progress across video sites',
    version: '0.0.5',
    ...(isDevelopment && extensionKey ? { key: extensionKey } : {}),
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
