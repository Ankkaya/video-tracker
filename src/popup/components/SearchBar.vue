<script setup lang="ts">
defineProps<{
  query: string;
  platform: string;
}>();

const emit = defineEmits<{
  'update:query': [value: string];
  'update:platform': [value: string];
}>();

const platforms = [
  { value: 'all', label: '全部' },
  { value: 'bilibili', label: 'B站' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'iqiyi', label: '爱奇艺' },
  { value: 'vqq', label: '腾讯视频' },
];
</script>

<template>
  <div class="search-bar">
    <input
      type="text"
      :value="query"
      @input="emit('update:query', ($event.target as HTMLInputElement).value)"
      placeholder="搜索视频标题..."
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
