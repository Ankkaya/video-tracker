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
    name: '__MSG_extensionName__',
    description: '__MSG_extensionDescription__',
    default_locale: 'en_US',
    version: '0.0.10',
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
        description: '__MSG_manualSaveDescription__',
      },
    },
  },
  hooks: {
    'build:manifestGenerated': (_, manifest) => {
      if (manifest.options_ui) {
        manifest.options_ui.open_in_tab = true;
      }
    },
  },
});
