<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

defineProps<{
  query: string;
  platform: string;
}>();

const emit = defineEmits<{
  'update:query': [value: string];
  'update:platform': [value: string];
}>();

const { t } = useI18n();

const platforms = computed(() => [
  { value: 'all', label: t('popup.platforms.all') },
  { value: 'bilibili', label: t('popup.platforms.bilibili') },
  { value: 'youtube', label: t('popup.platforms.youtube') },
  { value: 'iqiyi', label: t('popup.platforms.iqiyi') },
  { value: 'vqq', label: t('popup.platforms.vqq') },
]);
</script>

<template>
  <div class="search-bar">
    <input
      type="text"
      :value="query"
      @input="emit('update:query', ($event.target as HTMLInputElement).value)"
      :placeholder="t('popup.searchPlaceholder')"
      class="search-input"
    />
    <div class="platform-filter">
      <button
        v-for="p in platforms"
        :key="p.value"
        :class="['filter-btn', { active: platform === p.value }]"
        @click="emit('update:platform', p.value)"
      >
        {{ p.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.search-bar {
  margin-bottom: 12px;
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: #4361ee;
}

.platform-filter {
  display: flex;
  gap: 4px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.filter-btn {
  padding: 4px 10px;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  background: white;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-btn:hover {
  border-color: #4361ee;
  color: #4361ee;
}

.filter-btn.active {
  background: #4361ee;
  color: white;
  border-color: #4361ee;
}
</style>
