<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  NCard, NSwitch, NSelect, NSpace, NText, NDivider, useMessage, NButton, NTag,
} from 'naive-ui';
import type { Settings } from '../../shared/types';
import { THRESHOLD_OPTIONS, DEFAULT_SETTINGS } from '../../shared/constants';
import { api } from '../composables/useApi';
import { setLanguage, type Language, SUPPORTED_LANGUAGES } from '../../locales';
import { useAuth } from '../composables/useAuth';
import { useSync } from '../composables/useSync';

const { t, locale } = useI18n();
const message = useMessage();
const settings = ref<Settings>({ ...DEFAULT_SETTINGS });

const { isLoggedIn, user, checkSession, signOut } = useAuth();
const { isSyncing, syncRecords } = useSync();
const syncStatus = ref<'not-synced' | 'logged-in' | 'syncing' | 'success' | 'error'>('not-synced');
const lastSyncTime = ref<string | null>(null);
const autoSyncEnabled = ref(true);

const thresholdOptions = computed(() => THRESHOLD_OPTIONS.map((threshold) => ({
  label: threshold === 0 ? t('options.settings.immediateRecord') : `${threshold} ${t('common.seconds')}`,
  value: threshold,
})));

const languageOptions = computed(() =>
  Object.entries(SUPPORTED_LANGUAGES).map(([value, label]) => ({ value, label }))
);

const currentLanguage = ref<Language>(locale.value as Language);

onMounted(async () => {
  const s = await api.getSettings();
  if (s) settings.value = s;
  await checkSession();
  updateSyncStatus();
});

function onLanguageChange(lang: Language) {
  currentLanguage.value = lang;
  locale.value = lang;
  setLanguage(lang);
}

async function onAutoRecordChange(val: boolean) {
  settings.value.autoRecord = val;
  await persist();
}

async function onThresholdChange(val: number) {
  settings.value.threshold = val;
  await persist();
}

async function persist() {
  await api.updateSettings(settings.value);
  message.success(t('options.settings.saveSuccess'));
}

function updateSyncStatus() {
  if (!isLoggedIn.value) {
    syncStatus.value = 'not-synced';
  } else {
    syncStatus.value = 'logged-in';
  }
}

async function handleLogin() {
  // Open Supabase auth in a new window/tab
  const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  message.info('Please configure Supabase credentials first. Create a project at https://supabase.com');
}

async function handleLogout() {
  const result = await signOut();
  if (result.success) {
    message.success(t('options.settings.logoutSuccess'));
    updateSyncStatus();
  } else {
    message.error(result.error || t('options.settings.loginFailed'));
  }
}

async function handleAutoSyncChange(val: boolean) {
  autoSyncEnabled.value = val;
  // TODO: Persist auto sync setting
}

async function handleSync() {
  if (!isLoggedIn.value) {
    message.warning(t('options.settings.syncStatusNotSynced'));
    return;
  }

  syncStatus.value = 'syncing';

  // Get local records
  const localRecords = await api.getRecords();

  // Convert WatchRecord to LocalRecord
  const convertedRecords = (localRecords || []).map(record => ({
    id: record.id,
    platform: record.platform,
    videoId: record.id, // Use id as videoId for now
    title: record.title,
    thumbnail: record.thumbnail,
    progress: record.progress,
    duration: record.duration,
    watchedAt: record.lastWatchedAt,
  }));

  // Sync with cloud
  const result = await syncRecords(convertedRecords);

  if (result.success) {
    syncStatus.value = 'success';
    lastSyncTime.value = new Date().toLocaleString();
    message.success(t('options.settings.syncStatusSuccess'));

    // Update local records with synced data
    if (result.records) {
      // TODO: Merge cloud records with local records
    }

    setTimeout(() => {
      updateSyncStatus();
    }, 3000);
  } else {
    syncStatus.value = 'error';
    message.error(result.error || t('options.settings.syncFailed'));
  }
}

function getSyncStatusText() {
  switch (syncStatus.value) {
    case 'not-synced':
      return t('options.settings.syncStatusNotSynced');
    case 'logged-in':
      return t('options.settings.syncStatusLoggedIn');
    case 'syncing':
      return t('options.settings.syncStatusSyncing');
    case 'success':
      return t('options.settings.syncStatusSuccess');
    case 'error':
      return t('options.settings.syncStatusError');
  }
}

function getSyncStatusType() {
  switch (syncStatus.value) {
    case 'not-synced':
      return 'default';
    case 'logged-in':
      return 'info';
    case 'syncing':
      return 'warning';
    case 'success':
      return 'success';
    case 'error':
      return 'error';
  }
}
</script>

<template>
  <NCard>
    <NSpace vertical :size="0">
      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">{{ t('language.title') }}</div>
          <NText depth="3" style="font-size: 13px">
            {{ t('language.description') }}
          </NText>
        </div>
        <NSelect
          :value="currentLanguage"
          :options="languageOptions"
          style="width: 140px"
          @update:value="onLanguageChange"
        />
      </div>

      <NDivider style="margin: 16px 0" />

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">{{ t('options.settings.autoRecordLabel') }}</div>
          <NText depth="3" style="font-size: 13px">
            {{ t('options.settings.autoRecordDesc') }}
          </NText>
        </div>
        <NSwitch :value="settings.autoRecord" @update:value="onAutoRecordChange" />
      </div>

      <NDivider style="margin: 16px 0" />

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">{{ t('options.settings.thresholdLabel') }}</div>
          <NText depth="3" style="font-size: 13px">
            {{ t('options.settings.thresholdDesc') }}
          </NText>
        </div>
        <NSelect
          :value="settings.threshold"
          :options="thresholdOptions"
          style="width: 140px"
          @update:value="onThresholdChange"
        />
      </div>

      <NDivider style="margin: 16px 0" />

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">{{ t('options.settings.shortcutLabel') }}</div>
          <NText depth="3" style="font-size: 13px">
            {{ t('options.settings.shortcutDesc') }}
          </NText>
        </div>
        <NSpace :size="4">
          <kbd>Ctrl</kbd>
          <span>+</span>
          <kbd>Shift</kbd>
          <span>+</span>
          <kbd>V</kbd>
        </NSpace>
      </div>

      <NDivider style="margin: 16px 0" />

      <div class="setting-section">
        <div class="section-header">
          <div class="setting-info">
            <div class="setting-label">{{ t('options.settings.syncTitle') }}</div>
            <NText depth="3" style="font-size: 13px">
              {{ t('options.settings.syncDesc') }}
            </NText>
          </div>
        </div>
        <NSpace vertical :size="12">
          <div class="setting-row">
            <div class="setting-info">
              <NText depth="3" style="font-size: 13px">
                {{ t('options.settings.syncStatus') }}
              </NText>
            </div>
            <NTag :type="getSyncStatusType()">{{ getSyncStatusText() }}</NTag>
          </div>
          <div class="setting-row" v-if="lastSyncTime">
            <div class="setting-info">
              <NText depth="3" style="font-size: 13px">
                {{ t('options.settings.lastSync') }}
              </NText>
            </div>
            <NText depth="3" style="font-size: 13px">
              {{ lastSyncTime }}
            </NText>
          </div>
          <div class="setting-row" v-if="isLoggedIn">
            <div class="setting-info">
              <NText depth="3" style="font-size: 13px">
                {{ t('options.settings.autoSync') }}
              </NText>
              <NText depth="3" style="font-size: 12px">
                {{ t('options.settings.autoSyncDesc') }}
              </NText>
            </div>
            <NSwitch :value="autoSyncEnabled" @update:value="handleAutoSyncChange" />
          </div>
          <div class="setting-row">
            <div class="setting-info"></div>
            <NSpace :size="8">
              <NButton v-if="isLoggedIn" @click="handleSync" :loading="isSyncing">
                {{ t('common.save') }}
              </NButton>
              <NButton v-if="isLoggedIn" @click="handleLogout">
                {{ t('options.settings.logout') }}
              </NButton>
            </NSpace>
          </div>
        </NSpace>
      </div>
    </NSpace>
  </NCard>
</template>

<style scoped>
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
}
.setting-info {
  flex: 1;
  margin-right: 20px;
}
.setting-label {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 4px;
}
kbd {
  background: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  font-family: monospace;
  font-weight: 600;
}
.setting-section {
  padding: 4px 0;
}
.section-header {
  margin-bottom: 8px;
}
</style>
