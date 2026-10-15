<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  NInput, NDatePicker, NButton, NCheckbox, NAlert,
  NPagination, NSpace, NEmpty, NTag, NProgress, NTooltip,
  NCard, NPopconfirm, useMessage, useDialog, NText, NRadioGroup, NRadioButton,
} from 'naive-ui';
import type { WatchRecord } from '../../shared/types';
import { api, BackgroundUnavailableError } from '../composables/useApi';
import { formatTime, formatDate } from '../utils/format';
import SiteIcon from '../../shared/components/SiteIcon.vue';
import { STORAGE_KEYS } from '../../shared/constants';
import { buildRecordResumeUrl } from '../../shared/resume';
import { isRecordCompleted } from '../../shared/watchStatus';

const { t } = useI18n();
const message = useMessage();
const dialog = useDialog();

const records = ref<WatchRecord[]>([]);
const recordsLoaded = ref(false);
const recordsError = ref(false);
const completionPending = ref(new Set<string>());
const completionError = ref<{ message: string; needsReload: boolean } | null>(null);
const searchQuery = ref('');
const statusFilter = ref<'watching' | 'completed'>('watching');
/** [startMs, endMs] 或 null */
const dateRange = ref<[number, number] | null>(null);
const currentPage = ref(1);
const PAGE_SIZE = 20;
const selected = ref<Set<string>>(new Set());

const filteredRecords = computed(() =>
  records.value.filter((r) => {
    if (isRecordCompleted(r) !== (statusFilter.value === 'completed')) return false;
    const q = searchQuery.value.toLowerCase();
    const matchSearch =
      !q || r.title.toLowerCase().includes(q) || r.episode.toLowerCase().includes(q);
    if (dateRange.value) {
      const [start, end] = dateRange.value;
      if (r.lastWatchedAt < start || r.lastWatchedAt > end) return false;
    }
    return matchSearch;
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
  recordsError.value = false;
  try {
    const list = await api.getRecords();
    records.value = list.sort((a, b) => b.lastWatchedAt - a.lastWatchedAt);
    recordsLoaded.value = true;
  } catch {
    recordsError.value = true;
  }
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

watch([searchQuery, dateRange, statusFilter], () => {
  currentPage.value = 1;
  selected.value.clear();
});
watch(totalPages, pages => { currentPage.value = Math.min(currentPage.value, pages); });

function resetFilters() {
  searchQuery.value = '';
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

async function openRecord(record: WatchRecord) {
  try {
    await chrome.tabs.create({ url: buildRecordResumeUrl(record) });
  } catch {
    message.error(t('options.records.openFailed'));
  }
}

async function toggleCompleted(record: WatchRecord) {
  if (completionPending.value.has(record.id)) return;
  completionPending.value.add(record.id);
  completionError.value = null;
  try {
    const updated = await api.setCompleted(record.id, !isRecordCompleted(record));
    if (updated) records.value = records.value.map(item => item.id === updated.id ? updated : item);
    else await loadRecords();
  } catch (error) {
    const needsReload = error instanceof BackgroundUnavailableError;
    const reason = error instanceof Error ? error.message : String(error);
    completionError.value = {
      message: needsReload ? t('options.records.statusNeedsReload') : t('options.records.statusFailedDetail', { reason }),
      needsReload,
    };
  } finally {
    completionPending.value.delete(record.id);
  }
}

function reloadExtension() { chrome.runtime.reload(); }

defineExpose({ reload: loadRecords });
</script>

<template>
  <NCard class="records-panel" data-tour="records">
    <NAlert v-if="completionError" type="error" class="completion-error" closable @close="completionError = null" style="margin-bottom: 16px">
      {{ completionError.message }}
      <div v-if="completionError.needsReload" style="margin-top: 12px">
        <NButton size="small" @click="reloadExtension">{{ t('options.records.reloadExtension') }}</NButton>
      </div>
    </NAlert>
    <NRadioGroup v-model:value="statusFilter" name="watch-status" :aria-label="t('options.records.watchStatus')" style="margin-bottom: 16px">
      <NRadioButton value="watching">{{ t('options.records.watching') }}</NRadioButton>
      <NRadioButton value="completed">{{ t('options.records.completed') }}</NRadioButton>
    </NRadioGroup>
    <NSpace v-if="recordsError" align="center" style="margin-bottom: 16px" role="alert">
      <NText type="error">{{ t('options.records.loadFailed') }}</NText>
      <NButton size="small" @click="loadRecords">{{ t('common.retry') }}</NButton>
    </NSpace>
    <NSpace align="center" wrap style="margin-bottom: 16px">
      <NInput
        v-model:value="searchQuery"
        :placeholder="t('options.records.searchPlaceholder')"
        clearable
        style="width: 240px"
      >
        <template #prefix>🔍</template>
      </NInput>
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
            <SiteIcon :url="record.url" :platform="record.platform" />
            <div class="record-main" @click="openRecord(record)">
              <div class="record-meta">
                <NText class="platform-name" depth="3">{{ record.platformName }}</NText>
                <NTag v-if="isRecordCompleted(record)" size="small" type="success">{{ t('options.records.completed') }}</NTag>
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
                color="#4361ee"
              />
              <NText depth="3" style="font-size: 11px">
                {{ formatTime(record.currentTime) }} / {{ formatTime(record.duration) }}
                ({{ (record.progress * 100).toFixed(1) }}%)
              </NText>
            </div>
            <div class="record-actions">
              <NTooltip :delay="200" trigger="hover">
                <template #trigger>
                  <NButton type="primary" class="record-action-btn resume-action" :aria-label="t(isRecordCompleted(record) ? 'options.records.replay' : 'common.continueWatching')" @click="openRecord(record)">
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5a1 1 0 0 1 1.5-.86l10 6a1.6 1.6 0 0 1 0 2.72l-10 6A1 1 0 0 1 8 18.5Z" /></svg>
                  </NButton>
                </template>
                {{ t(isRecordCompleted(record) ? 'options.records.replay' : 'common.continueWatching') }}
              </NTooltip>
              <NTooltip :delay="200" trigger="hover">
                <template #trigger>
                  <NButton class="record-action-btn status-action" :loading="completionPending.has(record.id)" :disabled="completionPending.has(record.id)" :type="isRecordCompleted(record) ? 'success' : 'primary'" :secondary="isRecordCompleted(record)" :ghost="!isRecordCompleted(record)" :aria-label="t(isRecordCompleted(record) ? 'options.records.markWatching' : 'options.records.markCompleted')" :aria-pressed="isRecordCompleted(record)" @click="toggleCompleted(record)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
                  </NButton>
                </template>
                {{ t(isRecordCompleted(record) ? 'options.records.markWatching' : 'options.records.markCompleted') }}
              </NTooltip>
              <NPopconfirm @positive-click="deleteRecord(record.id)">
                <template #trigger>
                  <NTooltip :delay="200" trigger="hover">
                    <template #trigger>
                      <NButton class="record-action-btn delete-action" :aria-label="t('popup.deleteTooltip')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg>
                      </NButton>
                    </template>
                    {{ t('popup.deleteTooltip') }}
                  </NTooltip>
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

    <NEmpty
      v-else-if="recordsLoaded && !recordsError"
      :description="t(records.length ? 'options.records.noMatches' : 'popup.emptyTitle')"
      :theme-overrides="{ iconSizeMedium: '48px' }"
      style="padding: 60px 0"
    >
      <template #icon>
        <div class="records-empty-icon" aria-hidden="true">📭</div>
      </template>
      <template #extra>
        <NButton v-if="records.length" @click="resetFilters">{{ t('options.records.clearFilters') }}</NButton>
      </template>
    </NEmpty>
  </NCard>
</template>

<style scoped>
.records-panel {
  border: 1px solid var(--layout-border);
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
}
.records-panel :deep(> .n-card__content) { padding: 24px; }
.records-empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  line-height: 1;
}
@media (max-width: 600px) {
  .records-panel :deep(> .n-card__content) { padding: 16px; }
}
.record-card { cursor: default; border-radius: 12px; }
.record-card :deep(> .n-card__content) { padding: 20px; }
.record-row {
  display: grid;
  grid-template-columns: auto 48px minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
}
.record-main {
  cursor: pointer;
  min-width: 0;
}
.record-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 24px;
  margin-bottom: 4px;
}
.platform-name {
  max-width: 120px;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.record-time {
  display: inline-flex;
  align-items: center;
  height: 24px;
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
}
.record-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 8px;
  white-space: nowrap;
}
.record-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: 8px;
}
.record-action-btn svg { display: block; width: 18px; height: 18px; }
.resume-action { color: #fff; }
.delete-action { color: var(--n-text-color); }
.delete-action:hover, .delete-action:focus-visible { color: #e5484d; background: rgba(229, 72, 77, 0.08); --n-border-hover: 1px solid #e5484d; --n-border-focus: 1px solid #e5484d; }
.record-action-btn:focus-visible { outline: 2px solid #4361ee; outline-offset: 3px; }
@media (max-width: 1000px) {
  .record-row { gap: 12px; }
  .record-actions { grid-column: 3 / -1; justify-content: flex-end; margin-left: 0; }
  .record-main { grid-column: 3 / -1; }
  .record-meta { flex-wrap: wrap; gap: 4px 8px; }
}
@media (max-width: 600px) {
  .record-card :deep(> .n-card__content) { padding: 14px; }
  .record-row { grid-template-columns: auto 40px minmax(0, 1fr); gap: 10px; }
  .record-row > :deep(.site-icon) { width: 40px; height: 40px; border-radius: 10px; }
  .record-actions { grid-column: 2 / -1; }
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
