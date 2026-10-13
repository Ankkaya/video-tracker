<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{
  query: string;
}>();

const emit = defineEmits<{
  'update:query': [value: string];
}>();

const { t } = useI18n();
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
</style>
