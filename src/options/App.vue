<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  NConfigProvider,
  NMessageProvider,
  NDialogProvider,
  NLayout,
  NText,
  NButton,
  NDropdown,
} from 'naive-ui';
import type { GlobalThemeOverrides } from 'naive-ui';
import RecordsTab from './components/RecordsTab.vue';
import SettingsTab from './components/SettingsTab.vue';
import SitesTab from './components/SitesTab.vue';
import LoginView from './components/LoginView.vue';
import { useAuth } from './composables/useAuth';
import { useSync } from './composables/useSync';
import { useTheme } from '../shared/composables/useTheme';
import { setLanguage, type Language, SUPPORTED_LANGUAGES } from '../locales';
import { STORAGE_KEYS } from '../shared/constants';
import { api } from './composables/useApi';
import { logger } from '../shared/logger';
import BrandIcon from '../shared/components/BrandIcon.vue';

type TabId = 'records' | 'settings' | 'sites';

const { t, locale } = useI18n();
const { isLoggedIn, user, loadAuthMeta, checkSession, consumePendingAuth, handleAuthCallback, signOut } = useAuth();
const { theme, toggleTheme, naiveTheme } = useTheme();
const {
  hasEncryptedCloudSync,
  restoreEncryptedSyncUnlock,
  syncEncryptedRecordsAndSites,
} = useSync();

const activeTab = ref<TabId>('records');
const recordsRef = ref<InstanceType<typeof RecordsTab> | null>(null);
const showLoginView = ref(false);

const languageOptions = computed(() =>
  Object.entries(SUPPORTED_LANGUAGES).map(([value, label]) => ({ key: value, label }))
);
const currentLanguage = ref<Language>(locale.value as Language);

function onLanguageChange(lang: Language) {
  currentLanguage.value = lang;
  locale.value = lang;
  setLanguage(lang);
}

const navigation = computed(() => (['records', 'settings', 'sites'] as TabId[]).map(id => ({
  id, label: t(`options.tabs.${id}`).replace(/^[^A-Za-z\u4e00-\u9fff]+/u, ''),
})));
const pageTitle = computed(() => showLoginView.value ? t('options.settings.login') : navigation.value.find(item => item.id === activeTab.value)?.label);
function selectPage(tab: TabId) {
  showLoginView.value = false;
  activeTab.value = tab;
}

function handleSelectLanguage(key: string) {
  onLanguageChange(key as Language);
}

async function runInitialSync() {
  if (!isLoggedIn.value) return;

  try {
    const localRecords = await api.getRecords();
    const settings = await api.getSettings();
    const localSites = settings?.siteRules ?? [];

    if (!await hasEncryptedCloudSync()) {
      logger.log('Initial sync skipped: encrypted sync is not initialized');
      return;
    }

    if (!await restoreEncryptedSyncUnlock()) {
      logger.log('Initial encrypted sync skipped: device is locked');
      return;
    }

    const result = await syncEncryptedRecordsAndSites(localRecords || [], localSites);
    if (!result.success) {
      logger.warn('Initial encrypted sync skipped:', result.error);
      return;
    }

    if ('siteRules' in result && Array.isArray(result.siteRules)) {
      await api.updateSettings({ siteRules: result.siteRules });
    }

    recordsRef.value?.reload();
  } catch (error) {
    logger.error('Initial sync failed:', error);
  }
}

// Check URL parameter for login mode
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('login') === 'true') {
  showLoginView.value = true;
}

watch(activeTab, (tab) => {
  if (tab === 'records') recordsRef.value?.reload();
});

onMounted(async () => {
  if (window.location.hash.includes('access_token')) {
    const result = await handleAuthCallback();
    if (result.success) {
      showLoginView.value = false;
      await runInitialSync();
      chrome.storage.onChanged.addListener(onStorageChanged);
      return;
    }
  }

  // 检查是否有 content script 从回调页面提取的 pending token
  const consumed = await consumePendingAuth();
  if (consumed) {
    showLoginView.value = false;
    await runInitialSync();
    chrome.storage.onChanged.addListener(onStorageChanged);
    return;
  }

  await checkSession();
  // If user is already logged in, hide login view
  if (isLoggedIn.value) {
    showLoginView.value = false;
  }
  chrome.storage.onChanged.addListener(onStorageChanged);
});

onUnmounted(() => {
  chrome.storage.onChanged.removeListener(onStorageChanged);
});

function onStorageChanged(changes: Record<string, chrome.storage.StorageChange>, areaName: string) {
  if (areaName === 'local' && changes[STORAGE_KEYS.AUTH_META]) {
    const oldValue = changes[STORAGE_KEYS.AUTH_META].oldValue;
    const newValue = changes[STORAGE_KEYS.AUTH_META].newValue;
    void loadAuthMeta();

    // 检测从未登录变为已登录，自动刷新页面加载最新数据
    if (!oldValue?.isLoggedIn && newValue?.isLoggedIn) {
      showLoginView.value = false;
      window.location.reload();
    }
  }
}

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#4361ee',
    primaryColorHover: '#3451de',
    primaryColorPressed: '#2941c5',
    primaryColorSuppl: '#4361ee',
    borderRadius: '8px',
  },
};

async function handleAuthClick() {
  if (isLoggedIn.value) {
    const result = await signOut();
    if (result.success) {
      await checkSession();
      showLoginView.value = false;
    }
  } else {
    showLoginView.value = true;
  }
}

function handleLoginSuccess() {
  showLoginView.value = false;
  checkSession().then(() => runInitialSync());
}

function handleBackToSettings() {
  showLoginView.value = false;
}

function handleLoginRequired() {
  showLoginView.value = true;
}

function getThemeIcon() {
  switch (theme.value) {
    case 'light': return '☀️';
    case 'dark': return '🌙';
    default: return '🌓';
  }
}
</script>

<template>
  <NConfigProvider :theme="naiveTheme" :theme-overrides="themeOverrides">
    <NMessageProvider>
      <NDialogProvider>
        <NLayout class="options-layout">
          <aside class="options-sidebar">
            <div class="sidebar-brand"><BrandIcon /><div><strong>VideoTracker</strong><NText depth="3">{{ t('options.layout.brandSubtitle') }}</NText></div></div>
            <nav class="sidebar-nav" :aria-label="t('options.layout.navigation')">
              <button v-for="item in navigation" :key="item.id" type="button" class="nav-item" :class="{ active: activeTab === item.id && !showLoginView }" :aria-current="activeTab === item.id && !showLoginView ? 'page' : undefined" @click="selectPage(item.id)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
                  <path v-if="item.id === 'records'" d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Zm0 0v6h6M8 13h8M8 17h6" />
                  <template v-else-if="item.id === 'settings'"><path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 2 3-1 2 3 3-1 1-3 3-1 2-3-2-2 1-3-3-2-3 1-2-3Z" /><circle cx="12" cy="11" r="3" /></template>
                  <template v-else><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></template>
                </svg>
                {{ item.label }}
              </button>
            </nav>
            <div class="sidebar-bottom">
              <div class="account-panel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="7" r="4" /><path d="M4 22v-3a8 8 0 0 1 16 0v3" /></svg><div class="account-details" :class="{ 'logged-out': !isLoggedIn }"><span v-if="isLoggedIn" class="user-email" :title="user?.email">{{ user?.email }}</span><NButton size="small" type="primary" ghost @click="handleAuthClick">{{ isLoggedIn ? t('options.settings.logout') : t('options.settings.login') }}</NButton></div></div>
            </div>
          </aside>
          <main class="options-main">
            <header class="page-header"><div><h1>{{ pageTitle }}</h1><NText depth="3">{{ t(`options.layout.${showLoginView ? 'login' : activeTab}Subtitle`) }}</NText></div><div class="header-right"><NButton @click="toggleTheme" :title="t('common.theme')" :aria-label="t('common.theme')">{{ getThemeIcon() }}</NButton><NDropdown trigger="click" :options="languageOptions" @select="handleSelectLanguage"><NButton :title="t('language.title')">{{ SUPPORTED_LANGUAGES[currentLanguage] }} <svg class="language-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke-linecap="round" stroke-linejoin="round" /></svg></NButton></NDropdown></div></header>
            <div class="page-content">
              <LoginView v-if="showLoginView" @success="handleLoginSuccess" @back="handleBackToSettings" />
              <RecordsTab v-else-if="activeTab === 'records'" ref="recordsRef" />
              <SettingsTab v-else-if="activeTab === 'settings'" @login-required="handleLoginRequired" />
              <SitesTab v-else />
            </div>
          </main>
        </NLayout>
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style>
body { margin: 0; }
.options-layout { --page-bg: #f6f7fb; --sidebar-bg: #fff; --layout-border: #e5e8f0; --muted-panel: #f4f6fc; min-height: 100vh; font-family: "Segoe UI", "Microsoft YaHei", sans-serif; }
.options-sidebar { position: fixed; inset: 0 auto 0 0; width: 240px; box-sizing: border-box; display: flex; flex-direction: column; padding: 28px 16px 20px; border-right: 1px solid var(--layout-border); background: var(--sidebar-bg); z-index: 10; overflow-y: auto; }
.sidebar-brand { display: flex; align-items: center; gap: 10px; padding: 0 8px; }
.sidebar-brand > .brand-icon { width: 40px; height: 40px; }
.sidebar-brand strong { display: block; font-size: 22px; letter-spacing: -.6px; }
.sidebar-brand .n-text { display: block; font-size: 12px; margin-top: 3px; }
.sidebar-nav { display: grid; gap: 10px; margin-top: 48px; }
.nav-item { display: flex; align-items: center; gap: 16px; width: 100%; padding: 16px; border: 0; border-radius: 9px; background: transparent; color: inherit; font: inherit; font-size: 16px; cursor: pointer; text-align: left; }
.nav-item svg { width: 24px; height: 24px; flex-shrink: 0; }
.nav-item:hover { background: var(--muted-panel); }
.nav-item.active { background: rgba(67,97,238,.09); color: #4361ee; font-weight: 600; }
.nav-item:focus-visible { outline: 2px solid #4361ee; outline-offset: 2px; }
.sidebar-bottom { margin-top: auto; padding-top: 32px; }
.account-panel { display: flex; align-items: center; gap: 12px; padding: 16px 12px; border-top: 1px solid var(--layout-border); background: var(--muted-panel); border-radius: 8px; }
.account-panel > svg { width: 28px; height: 28px; flex-shrink: 0; }
.account-details { display: grid; gap: 8px; min-width: 0; flex: 1; }
.user-email { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 600; }
.account-details.logged-out { display: flex; justify-content: flex-end; }
.language-chevron { width: 16px; height: 16px; margin-left: 8px; flex-shrink: 0; }
.options-main { margin-left: 240px; min-height: 100vh; box-sizing: border-box; padding: 32px 36px 48px; background: var(--page-bg); }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 28px; }
.page-header h1 { margin: 0 0 8px; font-size: 28px; line-height: 1.3; font-weight: 700; }
.header-right { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
.header-right .n-button { height: 38px; }
.page-content { max-width: 1400px; margin: 0; }
html.dark .options-layout { --page-bg: #181824; --sidebar-bg: #202030; --layout-border: #343448; --muted-panel: #28283c; }
html.dark .nav-item.active { color: #a6b4ff; background: rgba(67,97,238,.18); }
@media (max-width: 900px) { .options-sidebar { width: 200px; padding-inline: 12px; } .sidebar-brand strong { font-size: 18px; } .options-main { margin-left: 200px; padding: 24px; } .page-header { flex-wrap: wrap; gap: 16px; } }
@media (max-width: 600px) { .options-sidebar { position: static; width: auto; padding: 18px 16px; border-right: 0; border-bottom: 1px solid var(--layout-border); } .sidebar-nav { grid-template-columns: repeat(3, 1fr); gap: 4px; margin-top: 18px; } .nav-item { justify-content: center; gap: 6px; padding: 10px 4px; font-size: 12px; } .nav-item svg { width: 18px; height: 18px; } .sidebar-bottom { padding-top: 12px; } .account-panel { padding: 8px 12px; } .account-details { display: flex; align-items: center; justify-content: space-between; } .options-main { margin-left: 0; padding: 24px 16px; } .page-header h1 { font-size: 24px; } }
</style>
