<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { WatchRecord } from '../../shared/types';

const { t, locale } = useI18n();

const props = defineProps<{
  record: WatchRecord;
}>();

const emit = defineEmits<{
  delete: [];
  open: [];
}>();

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return t('popup.timeAgo.justNow');
  if (minutes < 60) return `${minutes} ${t('popup.timeAgo.minutes')}`;
  if (hours < 24) return `${hours} ${t('popup.timeAgo.hours')}`;
  if (days < 7) return `${days} ${t('popup.timeAgo.days')}`;

  return new Date(timestamp).toLocaleDateString(locale.value === 'zh-CN' ? 'zh-CN' : 'en-US');
}

const platformIcons: Record<string, string> = {
  bilibili: '📺',
  youtube: '▶️',
  iqiyi: '🥝',
  vqq: '🎬',
};

const progressPercent = (props.record.progress * 100).toFixed(1);
</script>

<template>
  <div class="record-item" @click="emit('open')">
    <div class="record-header">
      <span class="platform-icon">{{ platformIcons[record.platform] || '📹' }}</span>
      <span class="platform-name">{{ record.platformName }}</span>
      <span class="time">{{ formatDate(record.lastWatchedAt) }}</span>
      <button class="delete-btn" @click.stop="emit('delete')" :title="t('popup.deleteTooltip')">✕</button>
    </div>

    <div class="record-title">{{ record.title }}</div>
    <div class="record-episode" v-if="record.episode !== t('popup.mainFilm')">{{ record.episode }}</div>

    <div class="record-progress">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
      <span class="progress-text">
        {{ formatTime(record.currentTime) }} / {{ formatTime(record.duration) }}
        ({{ progressPercent }}%)
      </span>
    </div>
  </div>
</template>

<style scoped>
.record-item {
  background: white;
  border-radius: 10px;
  padding: 10px 12px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #e8e8e8;
}

.record-item:hover {
  border-color: #4361ee;
  box-shadow: 0 2px 8px rgba(67, 97, 238, 0.1);
}

.record-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  min-height: 22px;
}

.platform-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 22px;
  font-size: 14px;
  line-height: 1;
  flex: 0 0 auto;
}

.platform-name {
  display: inline-flex;
  align-items: center;
  max-width: 96px;
  height: 20px;
  font-size: 11px;
  line-height: 1;
  color: #666;
  background: #f0f0f0;
  padding: 0 6px;
  border-radius: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  height: 22px;
  font-size: 11px;
  line-height: 1;
  color: #999;
  white-space: nowrap;
}

.delete-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: none;
  border: none;
  cursor: pointer;
  color: #ccc;
  font-size: 14px;
  line-height: 1;
  padding: 0;
  border-radius: 4px;
  transition: all 0.2s;
  flex: 0 0 auto;
}

.delete-btn:hover {
  color: #ff4757;
  background: #fff0f0;
}

.record-title {
  font-size: 13px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-episode {
  font-size: 11px;
  color: #666;
  margin-bottom: 6px;
}

.record-progress {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.progress-bar {
  height: 4px;
  background: #e8e8e8;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4361ee, #3a86ff);
  border-radius: 2px;
  transition: width 0.3s;
}

.progress-text {
  font-size: 11px;
  color: #999;
}
</style>

<style>
html.dark .record-item {
  background: #222238;
  border-color: #383852;
}

html.dark .record-item:hover {
  border-color: #6c8cff;
  box-shadow: 0 2px 10px rgba(108, 140, 255, 0.18);
}

html.dark .platform-name {
  color: #c7ccda;
  background: #2d2d44;
}

html.dark .time {
  color: #9aa3b5;
}

html.dark .delete-btn {
  color: #7f8698;
}

html.dark .delete-btn:hover {
  color: #ff8f9a;
  background: rgba(255, 71, 87, 0.14);
}

html.dark .record-title {
  color: #f3f6ff;
}

html.dark .record-episode {
  color: #b9bdd0;
}

html.dark .progress-bar {
  background: #34344d;
}

html.dark .progress-text {
  color: #9aa3b5;
}
</style>
