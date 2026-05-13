<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, h } from 'vue';
import {
  NInput, NSelect, NDatePicker, NButton, NCheckbox,
  NPagination, NSpace, NEmpty, NTag, NProgress, NIcon,
  NCard, NPopconfirm, useMessage, useDialog,
} from 'naive-ui';
import type { WatchRecord } from '../../shared/types';
import { api } from '../composables/useApi';
import { formatTime, formatDate, platformIcons } from '../utils/format';

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

const platformOptions = [
  { label: '全部平台', value: 'all' },
  { label: 'B站', value: 'bilibili' },
  { label: 'YouTube', value: 'youtube' },
  { label: '爱奇艺', value: 'iqiyi' },
  { label: '腾讯视频', value: 'vqq' },
];

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

onMounted(() => {
  loadRecords();
  document.addEventListener('visibilitychange', onVisibilityChange);
});
onUnmounted(() => document.removeEventListener('visibilitychange', onVisibilityChange));

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
    title: '确认删除',
    content: `确认删除选中的 ${ids.length} 条记录？此操作不可撤销。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      await api.deleteRecords(ids);
      records.value = records.value.filter((r) => !selected.value.has(r.id));
      clearSelection();
      message.success(`已删除 ${ids.length} 条记录`);
    },
  });
}

async function deleteRecord(id: string) {
  await api.deleteRecord(id);
  records.value = records.value.filter((r) => r.id !== id);
  selected.value.delete(id);
  message.success('已删除');
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
        placeholder="搜索视频标题..."
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
          '今天': () => { const t = Date.now(); return [t, t]; },
          '最近7天': () => [Date.now() - 7 * 86400000, Date.now()],
          '最近30天': () => [Date.now() - 30 * 86400000, Date.now()],
          '最近90天': () => [Date.now() - 90 * 86400000, Date.now()],
        }"
      />
      <NButton @click="resetFilters">🔄 重置</NButton>
    </NSpace>

    <NSpace align="center" justify="space-between" style="margin-bottom: 12px">
      <NText depth="3" style="font-size: 12px">
        共 {{ filteredRecords.length }} 条记录，第 {{ currentPage }}/{{ totalPages }} 页
      </NText>
      <NSpace v-if="selectedCount > 0" align="center">
        <NTag type="info">已选 {{ selectedCount }} 条</NTag>
        <NButton type="error" size="small" @click="confirmBatchDelete">🗑️ 删除选中</NButton>
        <NButton size="small" @click="clearSelection">取消选择</NButton>
      </NSpace>
    </NSpace>

    <template v-if="filteredRecords.length > 0">
      <NCard size="small" style="margin-bottom: 8px">
        <NCheckbox
          :checked="allCurrentSelected"
          @update:checked="toggleSelectAll"
        >全选当前页</NCheckbox>
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
                v-if="record.episode !== '正片'"
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
              <NButton size="small" quaternary class="record-action-btn" @click="openRecord(record)" title="打开">🔗</NButton>
              <NPopconfirm @positive-click="deleteRecord(record.id)">
                <template #trigger>
                  <NButton size="small" quaternary type="error" class="record-action-btn" title="删除">🗑️</NButton>
                </template>
                确认删除这条记录？
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

    <NEmpty v-else description="暂无记录" style="padding: 60px 0">
      <template #icon>
        <div style="font-size: 48px">📭</div>
      </template>
      <template #extra>
        <NText depth="3">观看视频超过阈值时间后将自动记录</NText>
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
  color: #1a1a2e;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
