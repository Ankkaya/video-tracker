<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  NCard, NSwitch, NSelect, NSpace, NText, NDivider, useMessage,
} from 'naive-ui';
import type { Settings } from '../../shared/types';
import { THRESHOLD_OPTIONS, DEFAULT_SETTINGS } from '../../shared/constants';
import { api } from '../composables/useApi';
import { setLanguage, type Language, SUPPORTED_LANGUAGES } from '../../locales';

const { t, locale } = useI18n();
const message = useMessage();
const settings = ref<Settings>({ ...DEFAULT_SETTINGS });

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
