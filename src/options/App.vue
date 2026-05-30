<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  NConfigProvider,
  NMessageProvider,
  NDialogProvider,
  NTabs,
  NTabPane,
  NLayout,
  NLayoutHeader,
  NLayoutContent,
  NLayoutFooter,
  NH1,
  NText,
  NSpace,
  NButton,
  NSelect,
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

type TabId = 'records' | 'settings' | 'sites';

const { t, locale } = useI18n();
const { isLoggedIn, user, loadAuthMeta, checkSession, handleAuthCallback, signOut } = useAuth();
const { theme, toggleTheme, naiveTheme } = useTheme();
const { syncRecords, syncCustomSites } = useSync();

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

function getLanguageIcon() {
  switch (currentLanguage.value) {
    case 'zh-CN': return '🇨🇳';
    case 'en-US': return '🇺🇸';
    default: return '🌐';
  }
}

function handleSelectLanguage(key: string) {
  onLanguageChange(key as Language);
}

async function runInitialSync() {
  if (!isLoggedIn.value) return;

  try {
    const localRecords = await api.getRecords();
    const settings = await api.getSettings();
    const localSites = settings?.customSites ?? [];

    const recordsResult = await syncRecords(localRecords || []);
    if (!recordsResult.success) {
      logger.warn('Initial record sync skipped:', recordsResult.error);
      return;
    }

    const sitesResult = await syncCustomSites(localSites);
    if (!sitesResult.success) {
      logger.warn('Initial custom sites sync skipped:', sitesResult.error);
      return;
    }

    if (sitesResult.customSites) {
      await api.updateSettings({ customSites: sitesResult.customSites });
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
    void loadAuthMeta();
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
          <NLayoutHeader bordered class="options-header">
            <div class="header-content">
              <div class="header-left">
                <NH1 style="margin: 0">📹 VideoTracker</NH1>
                <NText depth="3">{{ t('options.headerSubtitle') }}</NText>
              </div>
              <div class="header-right">
                <span v-if="isLoggedIn && user?.email" class="user-email">{{ user.email }}</span>
                <NButton @click="toggleTheme" :title="t('common.theme')">
                  {{ getThemeIcon() }}
                </NButton>
                <NDropdown
                  trigger="click"
                  :options="languageOptions"
                  @select="handleSelectLanguage"
                >
                  <NButton :title="t('language.title')">
                    {{ getLanguageIcon() }}
                  </NButton>
                </NDropdown>
                <NButton @click="handleAuthClick">
                  {{ isLoggedIn ? t('options.settings.logout') : t('options.settings.login') }}
                </NButton>
              </div>
            </div>
          </NLayoutHeader>

          <NLayoutContent content-style="padding: 24px 32px 80px;">
            <LoginView v-if="showLoginView" @success="handleLoginSuccess" @back="handleBackToSettings" />
            <NTabs
              v-else
              v-model:value="activeTab"
              type="segment"
              size="large"
              animated
              style="margin-bottom: 16px"
            >
              <NTabPane name="records" :tab="t('options.tabs.records')">
                <RecordsTab ref="recordsRef" />
              </NTabPane>
              <NTabPane name="settings" :tab="t('options.tabs.settings')">
                <SettingsTab @login-required="handleLoginRequired" />
              </NTabPane>
              <NTabPane name="sites" :tab="t('options.tabs.sites')">
                <SitesTab />
              </NTabPane>
            </NTabs>
          </NLayoutContent>

          <NLayoutFooter bordered position="absolute" style="text-align: center; padding: 12px;">
            <NText depth="3" style="font-size: 12px">
              {{ t('options.footerVersion') }}
            </NText>
          </NLayoutFooter>
        </NLayout>
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style>
.options-layout { min-height: 100vh; }
.options-header { padding: 20px 32px; }
.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-left {
  flex: 1;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-email {
  font-size: 13px;
  color: #666;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Dark mode overrides for non-Naive elements */
.dark body {
  background: #1a1a2e;
}
</style>
