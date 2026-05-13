<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import type { WatchRecord } from '../shared/types';
import { MSG, STORAGE_KEYS } from '../shared/constants';
import RecordList from './components/RecordList.vue';
import EmptyState from './components/EmptyState.vue';

const records = ref<WatchRecord[]>([]);
const manualSaveStatus = ref<'idle' | 'saving' | 'success' | 'error'>('idle');

async function loadRecords() {
  try {
    const response = await chrome.runtime.sendMessage({ type: MSG.GET_RECORDS });
    if (response?.records) {
      records.value = response.records
        .sort((a: WatchRecord, b: WatchRecord) => b.lastWatchedAt - a.lastWatchedAt)
        .slice(0, 3);
    }
  } catch (err) {
    console.error('获取记录失败:', err);
  }
}

function onStorageChanged(changes: Record<string, chrome.storage.StorageChange>, areaName: string) {
  if (areaName === 'local' && changes[STORAGE_KEYS.RECORDS]) {
    void loadRecords();
  }
}

onMounted(async () => {
  await loadRecords();
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
    console.error('删除记录失败:', err);
  }
}

function openRecord(record: WatchRecord) {
  chrome.tabs.create({ url: record.url });
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
      data: { url: tab.url, title: tab.title || '未命名视频' },
    });

    if (response?.success) {
      manualSaveStatus.value = 'success';
      await loadRecords();
    } else {
      manualSaveStatus.value = 'error';
    }
  } catch (err) {
    console.error('手动添加失败:', err);
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
    console.error('启动选择器失败:', err);
  }
}
</script>

<template>
  <div class="popup-container">
    <header class="header">
      <h1 class="title">📹 VideoTracker</h1>
      <div class="header-actions">
        <button class="settings-btn" @click="openSettings" title="设置">⚙️</button>
      </div>
    </header>

    <RecordList
      v-if="recentRecords.length > 0"
      :records="recentRecords"
      @delete="deleteRecord"
      @open="openRecord"
    />

    <EmptyState v-else />

    <button class="view-all-btn" @click="openAllRecords">
      📋 查看全部记录 →
    </button>

    <div class="fallback-actions">
      <span class="fallback-label">自动识别失败时</span>
      <button
        class="fallback-btn"
        :class="{ success: manualSaveStatus === 'success', error: manualSaveStatus === 'error' }"
        :disabled="manualSaveStatus === 'saving'"
        @click="manualAddCurrentPage"
        title="兜底记录当前页面，不依赖视频进度"
      >
        <span v-if="manualSaveStatus === 'idle'">📌 手动记录</span>
        <span v-else-if="manualSaveStatus === 'saving'">⏳ 记录中</span>
        <span v-else-if="manualSaveStatus === 'success'">✅ 已记录</span>
        <span v-else>❌ 失败</span>
      </button>
      <button
        class="fallback-btn"
        @click="startPickerMode"
        title="兜底选择页面上的时间文本或播放器区域"
      >
        🎯 选择时间
      </button>
    </div>
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
  gap: 4px;
}

.title {
  font-size: 16px;
  font-weight: 700;
  color: #1a1a2e;
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
