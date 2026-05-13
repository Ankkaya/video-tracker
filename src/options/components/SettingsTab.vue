<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  NCard, NSwitch, NSelect, NSpace, NText, NDivider, useMessage,
} from 'naive-ui';
import type { Settings } from '../../shared/types';
import { THRESHOLD_OPTIONS, DEFAULT_SETTINGS } from '../../shared/constants';
import { api } from '../composables/useApi';

const message = useMessage();
const settings = ref<Settings>({ ...DEFAULT_SETTINGS });

const thresholdOptions = THRESHOLD_OPTIONS.map((t) => ({
  label: t === 0 ? '立即记录' : `${t} 秒`,
  value: t,
}));

onMounted(async () => {
  const s = await api.getSettings();
  if (s) settings.value = s;
});

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
  message.success('设置已保存');
}
</script>

<template>
  <NCard>
    <NSpace vertical :size="0">
      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">自动记录</div>
          <NText depth="3" style="font-size: 13px">
            开启后，观看视频达到阈值时间将自动记录
          </NText>
        </div>
        <NSwitch :value="settings.autoRecord" @update:value="onAutoRecordChange" />
      </div>

      <NDivider style="margin: 16px 0" />

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">最低观看时长</div>
          <NText depth="3" style="font-size: 13px">
            观看超过此时长后自动记录（设为0则立即记录）
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
          <div class="setting-label">手动记录快捷键</div>
          <NText depth="3" style="font-size: 13px">
            在视频页面按下快捷键可立即记录当前视频
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
</style>
