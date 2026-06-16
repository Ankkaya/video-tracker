<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { WatchRecord } from '../shared/types';
import { MSG, STORAGE_KEYS } from '../shared/constants';
import { logger } from '../shared/logger';
import RecordList from './components/RecordList.vue';
import EmptyState from './components/EmptyState.vue';
import SyncModal from './components/SyncModal.vue';
import { useAuth } from '../options/composables/useAuth';
import { useTheme } from '../shared/composables/useTheme';
import { useSync } from '../options/composables/useSync';
import { buildRecordResumeUrl } from '../shared/resume';

const { t } = useI18n();
const { isLoggedIn, loadAuthMeta, checkSession } = useAuth();
const { theme, toggleTheme } = useTheme();
const { isSyncing, syncMeta, loadSyncMeta } = useSync();

const records = ref<WatchRecord[]>([]);
const manualSaveStatus = ref<'idle' | 'saving' | 'success' | 'error'>('idle');
const showSyncModal = ref(false);

async function loadRecords() {
  try {
    const response = await chrome.runtime.sendMessage({ type: MSG.GET_RECORDS });
    if (response?.records) {
      records.value = response.records
        .sort((a: WatchRecord, b: WatchRecord) => b.lastWatchedAt - a.lastWatchedAt)
        .slice(0, 3);
    }
  } catch (err) {
    logger.error('获取记录失败:', err);
  }
}

function onStorageChanged(changes: Record<string, chrome.storage.StorageChange>, areaName: string) {
  if (areaName === 'local' && changes[STORAGE_KEYS.RECORDS]) {
    void loadRecords();
  }
  if (areaName === 'local' && changes[STORAGE_KEYS.SYNC_META]) {
    void loadSyncMeta();
  }
  if (areaName === 'local' && changes[STORAGE_KEYS.AUTH_META]) {
    void loadAuthMeta();
    void loadSyncMeta();
  }
}

onMounted(async () => {
  await loadRecords();
  await checkSession();
  await loadSyncMeta();
  chrome.storage.onChanged.addListener(onStorageChanged);
});

onUnmounted(() => {
  chrome.storage.onChanged.removeListener(onStorageChanged);
});

const recentRecords = computed(() => records.value);

async function deleteRecord(id: string) {
  try {
    await chrome.runtime.sendMessage({ type: MSG.DELETE_RECORD, data: { id } });
    records.value = records.value.filter((r) => r.id !== id);
  } catch (err) {
    logger.error('删除记录失败:', err);
  }
}

function openRecord(record: WatchRecord) {
  chrome.tabs.create({ url: buildRecordResumeUrl(record) });
}

function openSettings() {
  chrome.tabs.create({ url: chrome.runtime.getURL('/options.html') });
}

function openAllRecords() {
  chrome.tabs.create({ url: chrome.runtime.getURL('/options.html') });
}

/** 手动记录当前标签页（仅 URL + 标题） */
async function manualAddCurrentPage() {
  manualSaveStatus.value = 'saving';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      manualSaveStatus.value = 'error';
      setTimeout(() => { manualSaveStatus.value = 'idle'; }, 2000);
      return;
    }

    const response = await chrome.runtime.sendMessage({
      type: MSG.MANUAL_ADD_RECORD,
      data: { url: tab.url, title: tab.title || t('popup.emptyTitle') },
    });

    if (response?.success) {
      manualSaveStatus.value = 'success';
      await loadRecords();
    } else {
      manualSaveStatus.value = 'error';
    }
  } catch (err) {
    logger.error('手动添加失败:', err);
    manualSaveStatus.value = 'error';
  }
  setTimeout(() => { manualSaveStatus.value = 'idle'; }, 2000);
}

async function addSampleRecord() {
  manualSaveStatus.value = 'saving';
  try {
    const response = await chrome.runtime.sendMessage({
      type: MSG.ADD_SAMPLE_RECORD,
      data: {
        title: 'YouTube sample - resume at 10:00',
        episode: 'Sample video',
        platformName: 'YouTube',
      },
    });

    if (response?.success) {
      manualSaveStatus.value = 'success';
      await loadRecords();
    } else {
      manualSaveStatus.value = 'error';
    }
  } catch (err) {
    logger.error('添加示例记录失败:', err);
    manualSaveStatus.value = 'error';
  }
  setTimeout(() => { manualSaveStatus.value = 'idle'; }, 2000);
}

/** 启动 DOM 选择器模式：让用户在页面上选择时间元素 */
async function startPickerMode() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    // 向 content script 发送启动选择器的消息
    await chrome.tabs.sendMessage(tab.id, { type: MSG.START_PICKER });

    // 关闭 popup，让用户在页面上操作
    window.close();
  } catch (err) {
    logger.error('启动选择器失败:', err);
  }
}

const syncButtonState = computed(() => {
  if (!isLoggedIn.value) return 'offline';
  if (isSyncing.value || syncMeta.value.state === 'syncing') return 'syncing';
  if (syncMeta.value.state === 'error') return 'error';
  if (syncMeta.value.lastSyncAt) return 'synced';
  return 'idle';
});

function getSyncStatusText() {
  switch (syncButtonState.value) {
    case 'offline':
      return t('popup.sync.notLoggedIn');
    case 'syncing':
      return t('popup.sync.syncing');
    case 'error':
      return t('popup.sync.syncFailed');
    case 'synced':
      return t('popup.sync.synced');
    default:
      return t('popup.sync.notSynced');
  }
}

function getCloudIcon() {
  switch (syncButtonState.value) {
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

function getCloudIconColor() {
  switch (syncButtonState.value) {
    case 'synced':
      return '#2f9e44';
    case 'syncing':
      return '#4361ee';
    case 'error':
      return '#d9480f';
    default:
      return '#8c8c99';
  }
}

function getSyncButtonTitle() {
  if (syncMeta.value.lastError) {
    return syncMeta.value.lastError;
  }

  if (syncMeta.value.lastSyncAt) {
    return `${t('popup.sync.lastSync')}: ${new Date(syncMeta.value.lastSyncAt).toLocaleString()}`;
  }

  return getSyncStatusText();
}

function getSyncStatusClass() {
  return `sync-${syncButtonState.value}`;
}

function getThemeIcon() {
  switch (theme.value) {
    case 'light': return '☀️';
    case 'dark': return '🌙';
    default: return '🌓';
  }
}

function handleSyncMessage(text: string, type: 'success' | 'error' | 'info') {
  logger.log(`[${type}] ${text}`);
  void loadSyncMeta();
}

function handleSyncClick() {
  if (!isLoggedIn.value) {
    chrome.tabs.create({ url: chrome.runtime.getURL('/options.html?login=true') });
  } else {
    showSyncModal.value = true;
  }
}
</script>

<template>
  <div class="popup-container">
    <header class="header">
      <h1 class="title">{{ t('popup.title') }}</h1>
      <div class="header-actions">
        <button
          class="sync-btn"
          :class="getSyncStatusClass()"
          @click="handleSyncClick"
          :title="getSyncButtonTitle()"
        >
          <span class="cloud-icon" :style="{ color: getCloudIconColor() }">{{ getCloudIcon() }}</span>
          <span class="sync-text">{{ getSyncStatusText() }}</span>
        </button>
        <button class="theme-btn" @click="toggleTheme" :title="t('common.theme')">
          {{ getThemeIcon() }}
        </button>
        <button class="settings-btn" @click="openSettings" :title="t('common.settings')">⚙️</button>
      </div>
    </header>

    <RecordList
      v-if="recentRecords.length > 0"
      :records="recentRecords"
      @delete="deleteRecord"
      @open="openRecord"
    />

    <EmptyState v-else @add-sample="addSampleRecord" />

    <button class="view-all-btn" @click="openAllRecords">
      {{ t('popup.viewAllRecords') }}
    </button>

    <div class="fallback-actions">
      <span class="fallback-label">{{ t('popup.fallbackLabel') }}</span>
      <button
        class="fallback-btn"
        :class="{ success: manualSaveStatus === 'success', error: manualSaveStatus === 'error' }"
        :disabled="manualSaveStatus === 'saving'"
        @click="manualAddCurrentPage"
        :title="t('popup.manualRecord')"
      >
        <span v-if="manualSaveStatus === 'idle'">{{ t('popup.manualRecord') }}</span>
        <span v-else-if="manualSaveStatus === 'saving'">{{ t('popup.recording') }}</span>
        <span v-else-if="manualSaveStatus === 'success'">{{ t('popup.recorded') }}</span>
        <span v-else>{{ t('popup.failed') }}</span>
      </button>
      <button
        class="fallback-btn"
        @click="startPickerMode"
        :title="t('popup.selectTime')"
      >
        {{ t('popup.selectTime') }}
      </button>
    </div>

    <SyncModal v-model:show="showSyncModal" @message="handleSyncMessage" />
  </div>
</template>

<style scoped>
.popup-container {
  padding: 12px;
  min-width: 360px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sync-btn {
  background: #f6f7fb;
  border: 1px solid #e3e6ef;
  color: #4a4f61;
  cursor: pointer;
  font-size: 12px;
  padding: 4px 9px;
  border-radius: 6px;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: 132px;
  min-height: 28px;
}

.sync-btn:hover {
  background: #eef2ff;
  border-color: rgba(67, 97, 238, 0.35);
}

.cloud-icon {
  font-size: 16px;
  line-height: 1;
  width: 16px;
  text-align: center;
}

.sync-syncing .cloud-icon {
  animation: sync-spin 1s linear infinite;
}

.sync-text {
  font-size: 12px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sync-synced {
  background: #edf9f0;
  border-color: #b7e4c7;
  color: #2f9e44;
}

.sync-syncing {
  background: #edf2ff;
  border-color: #bac8ff;
  color: #364fc7;
}

.sync-error {
  background: #fff4e6;
  border-color: #ffc078;
  color: #d9480f;
}

@keyframes sync-spin {
  to {
    transform: rotate(360deg);
  }
}

.title {
  font-size: 16px;
  font-weight: 700;
  color: #1a1a2e;
}

.theme-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 4px;
  border-radius: 6px;
  transition: background 0.2s;
}

.theme-btn:hover {
  background: rgba(67, 97, 238, 0.1);
}

.settings-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  padding: 4px;
  border-radius: 6px;
  transition: background 0.2s;
}

.settings-btn:hover {
  background: rgba(67, 97, 238, 0.1);
}

.view-all-btn {
  width: 100%;
  margin-top: 12px;
  padding: 10px 16px;
  background: #f8f9fa;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #4361ee;
  cursor: pointer;
  transition: all 0.2s;
}

.view-all-btn:hover {
  background: #4361ee;
  color: white;
  border-color: #4361ee;
}

.fallback-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #eeeeee;
}

.fallback-label {
  flex: 1;
  font-size: 12px;
  color: #888;
}

.fallback-btn {
  border: 1px solid #e0e0e0;
  background: #ffffff;
  color: #555;
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.fallback-btn:hover {
  border-color: #4361ee;
  color: #4361ee;
  background: rgba(67, 97, 238, 0.06);
}

.fallback-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.fallback-btn.success {
  border-color: #2ecc71;
  color: #27ae60;
  background: rgba(46, 204, 113, 0.1);
}

.fallback-btn.error {
  border-color: #e74c3c;
  color: #c0392b;
  background: rgba(231, 76, 60, 0.1);
}

</style>

<style>
/* Dark mode styles (unscoped so html.dark ancestor selector works) */
html.dark .popup-container {
  background: #1a1a2e;
  color: #e0e0e0;
}

html.dark .title {
  color: #fff;
}

html.dark .sync-text {
  color: inherit;
}

html.dark .header {
  border-bottom: 1px solid #2d2d44;
}

html.dark .sync-btn:hover {
  background: rgba(67, 97, 238, 0.2);
}

html.dark .sync-btn {
  background: #222238;
  border-color: #383852;
  color: #b9bdd0;
}

html.dark .sync-synced {
  background: rgba(47, 158, 68, 0.16);
  border-color: rgba(47, 158, 68, 0.42);
  color: #69db7c;
}

html.dark .sync-syncing {
  background: rgba(67, 97, 238, 0.2);
  border-color: rgba(116, 143, 252, 0.45);
  color: #91a7ff;
}

html.dark .sync-error {
  background: rgba(217, 72, 15, 0.16);
  border-color: rgba(255, 146, 43, 0.45);
  color: #ffa94d;
}

html.dark .settings-btn {
  color: #aaa;
}

html.dark .settings-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

html.dark .theme-btn {
  color: #aaa;
}

html.dark .theme-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

html.dark .view-all-btn {
  background: rgba(67, 97, 238, 0.2);
  color: #4361ee;
  border-color: #4361ee;
}

html.dark .view-all-btn:hover {
  background: rgba(67, 97, 238, 0.3);
}

html.dark .fallback-actions {
  border-top: 1px solid #2d2d44;
}

html.dark .fallback-label {
  color: #888;
}

html.dark .fallback-btn {
  border-color: #3d3d5c;
  background: #1a1a2e;
  color: #aaa;
}

html.dark .fallback-btn:hover {
  border-color: #4361ee;
  color: #4361ee;
  background: rgba(67, 97, 238, 0.1);
}
</style>
