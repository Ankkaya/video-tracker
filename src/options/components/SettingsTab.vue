<script setup lang="ts">
import { h, ref, onMounted, onUnmounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  NCard, NSwitch, NSelect, NSpace, NText, NDivider, NInput, useDialog, useMessage,
} from 'naive-ui';
import type { Settings } from '../../shared/types';
import { THRESHOLD_OPTIONS, DEFAULT_SETTINGS, STORAGE_KEYS } from '../../shared/constants';
import { api } from '../composables/useApi';
import { useAuth } from '../composables/useAuth';
import { useSync } from '../composables/useSync';
import { logger } from '../../shared/logger';

const { t } = useI18n();
const message = useMessage();
const dialog = useDialog();
const settings = ref<Settings>({ ...DEFAULT_SETTINGS });
const emit = defineEmits<{
  loginRequired: []
}>();

const { isLoggedIn, loadAuthMeta, checkSession } = useAuth();
const {
  isSyncing,
  syncMeta,
  loadSyncMeta,
  hasEncryptedCloudSync,
  isEncryptedSyncUnlocked,
  restoreEncryptedSyncUnlock,
  initializeEncryptedSync,
  unlockEncryptedSync,
  syncEncryptedRecordsAndSites,
} = useSync();
const encryptionInitialized = ref(false);
const encryptionUnlocked = ref(false);
const encryptionBusy = ref(false);
const encryptionStateLoading = ref(false);
const encryptionDialogOpen = ref(false);

const thresholdOptions = computed(() => THRESHOLD_OPTIONS.map((threshold) => ({
  label: threshold === 0 ? t('options.settings.immediateRecord') : `${threshold} ${t('common.seconds')}`,
  value: threshold,
})));


onMounted(async () => {
  const s = await api.getSettings();
  if (s) settings.value = s;
  await checkSession();
  await loadSyncMeta();
  await refreshEncryptionState();
  chrome.storage.onChanged.addListener(onStorageChanged);
});

onUnmounted(() => {
  chrome.storage.onChanged.removeListener(onStorageChanged);
});

function onStorageChanged(changes: Record<string, chrome.storage.StorageChange>, areaName: string) {
  if (areaName === 'local' && changes[STORAGE_KEYS.AUTH_META]) {
    void loadAuthMeta();
  }
  if (areaName === 'local' && changes[STORAGE_KEYS.SYNC_META]) {
    void loadSyncMeta();
  }
  if (areaName === 'local' && changes[STORAGE_KEYS.AUTH_META]) {
    void refreshEncryptionState();
  }
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

async function handleAutoSyncChange(val: boolean) {
  if (encryptionBusy.value || encryptionDialogOpen.value || encryptionStateLoading.value) return;

  if (!val) {
    settings.value.autoSync = false;
    await persist();
    return;
  }

  if (!isLoggedIn.value) {
    emit('loginRequired');
    return;
  }

  const password = await promptEncryptionPassword(
    encryptionInitialized.value
      ? t('options.settings.unlockEncryptedSync')
      : t('options.settings.enableEncryptedSync'),
    !encryptionInitialized.value,
  );
  if (!password) return;

  encryptionBusy.value = true;
  try {
    const localRecords = await api.getRecords();
    const localSites = settings.value.customSites ?? [];
    const result = encryptionInitialized.value
      ? await unlockEncryptedSync(password)
      : await initializeEncryptedSync(password, localRecords || [], localSites);

    if (!result.success) {
      message.error(result.error || t('options.settings.encryptedSyncUnlockFailed'));
      return;
    }

    encryptionInitialized.value = true;
    encryptionUnlocked.value = true;
    settings.value.autoSync = true;
    await persist();

    if (encryptionInitialized.value) {
      const syncResult = await syncEncryptedRecordsAndSites(localRecords || [], localSites);
      if (!syncResult.success) {
        message.error(syncResult.error || t('options.settings.syncFailed'));
        return;
      }
      if ('customSites' in syncResult && syncResult.customSites) {
        settings.value.customSites = syncResult.customSites;
        await api.updateSettings({ customSites: syncResult.customSites });
      }
    }

    message.success(t('options.settings.encryptedSyncSuccess'));
  } finally {
    encryptionBusy.value = false;
  }
}

async function handleSync() {
  if (!isLoggedIn.value) {
    emit('loginRequired');
    return;
  }

  await refreshEncryptionState();
  if (!encryptionInitialized.value) {
    await handleAutoSyncChange(true);
    return;
  }

  if (encryptionInitialized.value) {
    if (!encryptionUnlocked.value) {
      if (encryptionDialogOpen.value) return;
      const password = await promptEncryptionPassword(t('options.settings.unlockEncryptedSync'));
      if (!password) return;
      const unlockResult = await unlockEncryptedSync(password);
      if (!unlockResult.success) {
        message.error(unlockResult.error || t('options.settings.encryptedSyncUnlockFailed'));
        return;
      }
      encryptionUnlocked.value = true;
    }

    await handleEncryptedSync();
    return;
  }
}

async function refreshEncryptionState() {
  if (!isLoggedIn.value) {
    encryptionInitialized.value = false;
    encryptionUnlocked.value = false;
    return;
  }

  encryptionStateLoading.value = true;
  try {
    encryptionInitialized.value = await hasEncryptedCloudSync();
    encryptionUnlocked.value = encryptionInitialized.value
      ? isEncryptedSyncUnlocked() || await restoreEncryptedSyncUnlock()
      : false;

    if (encryptionInitialized.value && !encryptionUnlocked.value && settings.value.autoSync) {
      settings.value.autoSync = false;
      await api.updateSettings({ autoSync: false });
    }
  } finally {
    encryptionStateLoading.value = false;
  }
}

function promptEncryptionPassword(title: string, requireConfirm = false): Promise<string | null> {
  const password = ref('');
  const passwordConfirm = ref('');
  encryptionDialogOpen.value = true;

  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: string | null) => {
      if (settled) return;
      settled = true;
      encryptionDialogOpen.value = false;
      resolve(value);
    };
    const submit = () => {
      if (!password.value) {
        message.error(t('options.settings.pleaseEnterEncryptionPassword'));
        return false;
      }
      if (requireConfirm && password.value !== passwordConfirm.value) {
        message.error(t('options.settings.passwordMismatch'));
        return false;
      }
      settle(password.value);
      return true;
    };
    const instance = dialog.create({
      title,
      content: () => h('div', { class: 'encryption-password-dialog' }, [
        h('p', { class: 'encryption-password-tip' }, t('options.settings.encryptionPasswordTip')),
        h(NInput, {
          value: password.value,
          type: 'password',
          showPasswordOn: 'click',
          autofocus: true,
          placeholder: t('options.settings.encryptionPassword'),
          'onUpdate:value': (value: string) => {
            password.value = value;
          },
          onKeydown: (event: KeyboardEvent) => {
            if (event.key === 'Enter' && !requireConfirm) {
              if (submit()) {
                instance.destroy();
              }
            }
          },
        }),
        requireConfirm ? h(NInput, {
          value: passwordConfirm.value,
          type: 'password',
          showPasswordOn: 'click',
          placeholder: t('options.settings.confirmEncryptionPassword'),
          style: 'margin-top: 8px',
          'onUpdate:value': (value: string) => {
            passwordConfirm.value = value;
          },
          onKeydown: (event: KeyboardEvent) => {
            if (event.key === 'Enter' && submit()) {
              instance.destroy();
            }
          },
        }) : null,
      ]),
      positiveText: t('common.confirm'),
      negativeText: t('common.cancel'),
      onPositiveClick: () => {
        return submit();
      },
      onNegativeClick: () => settle(null),
      onClose: () => settle(null),
      onEsc: () => settle(null),
      onMaskClick: () => settle(null),
      onAfterLeave: () => settle(null),
    });
  });
}

async function handleEncryptedSync() {
  if (!isLoggedIn.value) {
    emit('loginRequired');
    return;
  }

  if (!encryptionUnlocked.value) {
    message.error(t('options.settings.encryptedSyncLocked'));
    return;
  }

  encryptionBusy.value = true;
  try {
    const localRecords = await api.getRecords();
    const result = await syncEncryptedRecordsAndSites(localRecords || [], settings.value.customSites ?? []);
    if (!result.success) {
      message.error(result.error || t('options.settings.syncFailed'));
      return;
    }

    if ('customSites' in result && result.customSites) {
      settings.value.customSites = result.customSites;
      await api.updateSettings({ customSites: result.customSites });
    }

    message.success(t('options.settings.encryptedSyncSuccess'));
  } finally {
    encryptionBusy.value = false;
  }
}

const syncStatus = computed(() => {
  if (!isLoggedIn.value) return 'not-logged-in';
  if (isSyncing.value || syncMeta.value.state === 'syncing') return 'syncing';
  if (syncMeta.value.state === 'error') return 'error';
  if (syncMeta.value.lastSyncAt) return 'synced';
  return 'not-synced';
});

const lastSyncTime = computed(() => (
  syncMeta.value.lastSyncAt ? new Date(syncMeta.value.lastSyncAt).toLocaleString() : ''
));

function getSyncStatusIcon() {
  switch (syncStatus.value) {
    case 'syncing':
      return '↻';
    case 'error':
      return '!';
    case 'synced':
      return '✓';
    default:
      return '☁';
  }
}

function getSyncStatusClass() {
  return `sync-status-${syncStatus.value}`;
}

function getSyncStatusTitle() {
  if (syncMeta.value.lastError) {
    return syncMeta.value.lastError;
  }

  if (syncMeta.value.lastSyncAt) {
    return `${t('options.settings.lastSync')}: ${lastSyncTime.value}`;
  }

  return t('options.settings.syncDesc');
}

function getSyncStatusActionText() {
  switch (syncStatus.value) {
    case 'syncing':
      return t('options.settings.syncStatusSyncing');
    case 'synced':
      return t('options.settings.syncStatusSuccess');
    case 'error':
      return t('options.settings.syncStatusError');
    case 'not-logged-in':
      return t('options.settings.syncLoginRequired');
    case 'not-synced':
    default:
      return t('options.settings.syncStatusNotSynced');
  }
}
</script>

<template>
  <NCard>
    <NSpace vertical :size="0">
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
            <button
              class="sync-status-wrapper"
              :class="getSyncStatusClass()"
              :disabled="isSyncing && isLoggedIn"
              @click="handleSync"
              :title="getSyncStatusTitle()"
            >
              <span class="sync-icon">{{ getSyncStatusIcon() }}</span>
              <span class="sync-status-text">{{ getSyncStatusActionText() }}</span>
            </button>
          </div>
          <div class="setting-row" v-if="isLoggedIn && lastSyncTime">
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
            <NSwitch
              :value="settings.autoSync"
              :loading="encryptionBusy || encryptionDialogOpen || encryptionStateLoading || isSyncing"
              @update:value="handleAutoSyncChange"
            />
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

.sync-status-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  max-width: 180px;
  padding: 5px 10px;
  border: 1px solid #e3e6ef;
  border-radius: 6px;
  background: #f6f7fb;
  color: #4a4f61;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}

.sync-status-wrapper:hover:not(:disabled) {
  background: #eef2ff;
  border-color: rgba(67, 97, 238, 0.35);
}

.sync-status-wrapper:disabled {
  cursor: progress;
}

.sync-icon {
  width: 15px;
  font-size: 14px;
  line-height: 1;
  text-align: center;
}

.sync-status-syncing .sync-icon {
  animation: sync-spin 1s linear infinite;
}

.sync-status-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sync-status-synced {
  background: #edf9f0;
  border-color: #b7e4c7;
  color: #2f9e44;
}

.sync-status-syncing {
  background: #edf2ff;
  border-color: #bac8ff;
  color: #364fc7;
}

.sync-status-error {
  background: #fff4e6;
  border-color: #ffc078;
  color: #d9480f;
}

@keyframes sync-spin {
  to {
    transform: rotate(360deg);
  }
}

.setting-section {
  padding: 4px 0;
}
.section-header {
  margin-bottom: 8px;
}
</style>

<style>
/* Dark mode styles (unscoped so html.dark ancestor selector works) */
html.dark .setting-label {
  color: #fff !important;
}

html.dark kbd {
  background: #2d2d44 !important;
  border-color: #3d3d5c !important;
  color: #e0e0e0 !important;
}

html.dark .setting-row span {
  color: #e0e0e0;
}

html.dark .sync-status-wrapper {
  background: #222238;
  border-color: #383852;
  color: #b9bdd0;
}

html.dark .sync-status-wrapper span {
  color: inherit;
}

html.dark .sync-status-synced {
  background: rgba(47, 158, 68, 0.16);
  border-color: rgba(47, 158, 68, 0.42);
  color: #69db7c;
}

html.dark .sync-status-syncing {
  background: rgba(67, 97, 238, 0.2);
  border-color: rgba(116, 143, 252, 0.45);
  color: #91a7ff;
}

html.dark .sync-status-error {
  background: rgba(217, 72, 15, 0.16);
  border-color: rgba(255, 146, 43, 0.45);
  color: #ffa94d;
}

.encryption-password-dialog {
  min-width: min(360px, 72vw);
}

.encryption-password-tip {
  margin: 0 0 12px;
  color: #606575;
  font-size: 13px;
  line-height: 1.5;
}

html.dark .encryption-password-tip {
  color: #b9bdd0;
}
</style>
