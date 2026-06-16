<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const emit = defineEmits<{
  addSample: [];
}>();
</script>

<template>
  <div class="empty-state">
    <div class="empty-icon">📭</div>
    <div class="empty-title">{{ t('popup.emptyTitle') }}</div>
    <div class="empty-desc" v-html="t('popup.emptyDesc')"></div>
    <button class="sample-btn" @click="emit('addSample')">
      {{ t('popup.addSampleRecord') }}
    </button>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 8px;
}

.empty-desc {
  font-size: 12px;
  color: #888;
  line-height: 1.6;
}

.sample-btn {
  margin-top: 14px;
  padding: 8px 12px;
  border: 1px solid #d7dcff;
  border-radius: 6px;
  background: #f3f5ff;
  color: #3451de;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}

.sample-btn:hover {
  background: #e9edff;
  border-color: #9da9ff;
}

kbd {
  background: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 3px;
  padding: 1px 5px;
  font-size: 11px;
  font-family: monospace;
}
</style>
