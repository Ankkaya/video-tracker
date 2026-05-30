<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, h } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  NInput, NSelect, NDatePicker, NButton, NCheckbox,
  NPagination, NSpace, NEmpty, NTag, NProgress, NIcon,
  NCard, NPopconfirm, useMessage, useDialog, NText,
} from 'naive-ui';
import type { WatchRecord } from '../../shared/types';
import { api } from '../composables/useApi';
import { formatTime, formatDate, platformIcons } from '../utils/format';
import { STORAGE_KEYS } from '../../shared/constants';

const { t } = useI18n();
const message = useMessage();
const dialog = useDialog();

const records = ref<WatchRecord[]>([]);
const searchQuery = ref('');
const platformFilter = ref<string>('all');
/** [startMs, endMs] 或 null */
const dateRange = ref<[number, number] | null>(null);
const currentPage = ref(1);
const PAGE_SIZE = 20;
const selected = ref<Set<string>>(new Set());

const platformOptions = computed(() => [
  { label: t('options.records.allPlatforms'), value: 'all' },
  { label: t('popup.platforms.bilibili'), value: 'bilibili' },
  { label: t('popup.platforms.youtube'), value: 'youtube' },
  { label: t('popup.platforms.iqiyi'), value: 'iqiyi' },
  { label: t('popup.platforms.vqq'), value: 'vqq' },
]);

const filteredRecords = computed(() =>
  records.value.filter((r) => {
    const q = searchQuery.value.toLowerCase();
    const matchSearch =
      !q || r.title.toLowerCase().includes(q) || r.episode.toLowerCase().includes(q);
    const matchPlatform = platformFilter.value === 'all' || r.platform === platformFilter.value;
    if (dateRange.value) {
      const [start, end] = dateRange.value;
      if (r.lastWatchedAt < start || r.lastWatchedAt > end) return false;
    }
    return matchSearch && matchPlatform;
  })
);

const totalPages = computed(() => Math.max(1, Math.ceil(filteredRecords.value.length / PAGE_SIZE)));
const pagedRecords = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE;
  return filteredRecords.value.slice(start, start + PAGE_SIZE);
});

const selectedCount = computed(() => selected.value.size);
const allCurrentSelected = computed(
  () => pagedRecords.value.length > 0 && pagedRecords.value.every((r) => selected.value.has(r.id))
);

async function loadRecords() {
  const list = await api.getRecords();
  records.value = list.sort((a, b) => b.lastWatchedAt - a.lastWatchedAt);
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') loadRecords();
}

function onStorageChanged(changes: Record<string, chrome.storage.StorageChange>, areaName: string) {
  if (areaName === 'local' && changes[STORAGE_KEYS.RECORDS]) {
    void loadRecords();
  }
}

onMounted(() => {
  loadRecords();
  document.addEventListener('visibilitychange', onVisibilityChange);
  chrome.storage.onChanged.addListener(onStorageChanged);
});
onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange);
  chrome.storage.onChanged.removeListener(onStorageChanged);
});

watch([searchQuery, platformFilter, dateRange], () => {
  currentPage.value = 1;
});

function resetFilters() {
  searchQuery.value = '';
  platformFilter.value = 'all';
  dateRange.value = null;
  currentPage.value = 1;
}

function toggleSelectAll(val: boolean) {
  if (val) {
    pagedRecords.value.forEach((r) => selected.value.add(r.id));
  } else {
    pagedRecords.value.forEach((r) => selected.value.delete(r.id));
  }
}

function toggleSelect(id: string, val: boolean) {
  if (val) selected.value.add(id);
  else selected.value.delete(id);
}

function clearSelection() {
  selected.value.clear();
}

function confirmBatchDelete() {
  const ids = Array.from(selected.value);
  if (!ids.length) return;
  dialog.warning({
    title: t('options.records.confirmDeleteTitle'),
    content: t('options.records.confirmDeleteContent', { count: ids.length }),
    positiveText: t('options.records.confirmDeletePositive'),
    negativeText: t('options.records.confirmDeleteNegative'),
    onPositiveClick: async () => {
      await api.deleteRecords(ids);
      records.value = records.value.filter((r) => !selected.value.has(r.id));
      clearSelection();
      message.success(t('options.records.deleteSuccess', { count: ids.length }));
    },
  });
}

async function deleteRecord(id: string) {
  await api.deleteRecord(id);
  records.value = records.value.filter((r) => r.id !== id);
  selected.value.delete(id);
  message.success(t('options.records.deleteSingleSuccess'));
}

function openRecord(record: WatchRecord) {
  chrome.tabs.create({ url: record.url });
}

defineExpose({ reload: loadRecords });
</script>

<template>
  <div>
    <NSpace align="center" wrap style="margin-bottom: 16px">
      <NInput
        v-model:value="searchQuery"
        :placeholder="t('options.records.searchPlaceholder')"
        clearable
        style="width: 240px"
      >
        <template #prefix>🔍</template>
      </NInput>
      <NSelect
        v-model:value="platformFilter"
        :options="platformOptions"
        style="width: 140px"
      />
      <NDatePicker
        v-model:value="dateRange"
        type="daterange"
        clearable
        placement="bottom-start"
        :shortcuts="{
          [t('options.records.dateShortcuts.today')]: () => { const t = Date.now(); return [t, t]; },
          [t('options.records.dateShortcuts.last7Days')]: () => [Date.now() - 7 * 86400000, Date.now()],
          [t('options.records.dateShortcuts.last30Days')]: () => [Date.now() - 30 * 86400000, Date.now()],
          [t('options.records.dateShortcuts.last90Days')]: () => [Date.now() - 90 * 86400000, Date.now()],
        }"
      />
      <NButton @click="resetFilters">{{ t('options.records.reset') }}</NButton>
    </NSpace>

    <NSpace align="center" justify="space-between" style="margin-bottom: 12px">
      <NText depth="3" style="font-size: 12px">
        {{ t('options.records.totalCount', { count: filteredRecords.length, current: currentPage, total: totalPages }) }}
      </NText>
      <NSpace v-if="selectedCount > 0" align="center">
        <NTag type="info">{{ t('options.records.selectedCount', { count: selectedCount }) }}</NTag>
        <NButton type="error" size="small" @click="confirmBatchDelete">{{ t('options.records.deleteSelected') }}</NButton>
        <NButton size="small" @click="clearSelection">{{ t('options.records.clearSelection') }}</NButton>
      </NSpace>
    </NSpace>

    <template v-if="filteredRecords.length > 0">
      <NCard size="small" style="margin-bottom: 8px">
        <NCheckbox
          :checked="allCurrentSelected"
          @update:checked="toggleSelectAll"
        >{{ t('options.records.selectAllCurrent') }}</NCheckbox>
      </NCard>

      <NSpace vertical :size="8">
        <NCard
          v-for="record in pagedRecords"
          :key="record.id"
          size="small"
          hoverable
          class="record-card"
        >
          <div class="record-row">
            <NCheckbox
              :checked="selected.has(record.id)"
              @update:checked="(v) => toggleSelect(record.id, v)"
            />
            <div class="record-main" @click="openRecord(record)">
              <div class="record-meta">
                <span class="platform-icon">{{ platformIcons[record.platform] || '📹' }}</span>
                <NTag class="platform-tag" size="small" :bordered="false">{{ record.platformName }}</NTag>
                <NText class="record-time" depth="3">
                  {{ formatDate(record.lastWatchedAt) }}
                </NText>
              </div>
              <div class="record-title">{{ record.title }}</div>
              <NText
                v-if="record.episode !== t('popup.mainFilm')"
                depth="3"
                style="font-size: 12px; display: block; margin-bottom: 4px"
              >{{ record.episode }}</NText>
              <NProgress
                :percentage="+(record.progress * 100).toFixed(1)"
                :show-indicator="false"
                :height="4"
              />
              <NText depth="3" style="font-size: 11px">
                {{ formatTime(record.currentTime) }} / {{ formatTime(record.duration) }}
                ({{ (record.progress * 100).toFixed(1) }}%)
              </NText>
            </div>
            <div class="record-actions">
              <NButton size="small" quaternary class="record-action-btn" @click="openRecord(record)" :title="t('options.records.openTooltip')">🔗</NButton>
              <NPopconfirm @positive-click="deleteRecord(record.id)">
                <template #trigger>
                  <NButton size="small" quaternary type="error" class="record-action-btn" :title="t('options.records.deleteTooltip')">🗑️</NButton>
                </template>
                {{ t('options.records.confirmDeleteSingle') }}
              </NPopconfirm>
            </div>
          </div>
        </NCard>
      </NSpace>

      <NPagination
        v-if="filteredRecords.length > PAGE_SIZE"
        v-model:page="currentPage"
        :page-count="totalPages"
        style="margin-top: 20px; justify-content: center"
      />
    </template>

    <NEmpty v-else :description="t('options.records.emptyDescription')" style="padding: 60px 0">
      <template #icon>
        <div style="font-size: 48px">📭</div>
      </template>
      <template #extra>
        <NText depth="3">{{ t('options.records.emptyExtra') }}</NText>
      </template>
    </NEmpty>
  </div>
</template>

<style scoped>
.record-card { cursor: default; }
.record-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.record-main {
  flex: 1;
  cursor: pointer;
  min-width: 0;
}
.record-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 24px;
  margin-bottom: 4px;
}
.platform-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 24px;
  line-height: 1;
  flex: 0 0 auto;
}
.platform-tag {
  display: inline-flex;
  align-items: center;
  max-width: 120px;
  height: 22px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.record-time {
  display: inline-flex;
  align-items: center;
  height: 24px;
  margin-left: auto;
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
}
.record-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  flex: 0 0 auto;
}
.record-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.record-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--n-text-color);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
