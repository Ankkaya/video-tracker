<script setup lang="ts">
import type { WatchRecord } from '../../shared/types';
import RecordItem from './RecordItem.vue';

defineProps<{
  records: WatchRecord[];
}>();

const emit = defineEmits<{
  delete: [id: string];
  open: [record: WatchRecord];
}>();
</script>

<template>
  <div class="record-list">
    <RecordItem
      v-for="record in records"
      :key="record.id"
      :record="record"
      @delete="emit('delete', record.id)"
      @open="emit('open', record)"
    />
  </div>
</template>

<style scoped>
.record-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
