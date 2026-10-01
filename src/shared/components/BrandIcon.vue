<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { StorageManager } from '../storage';
import { STORAGE_KEYS } from '../constants';

const enabled = ref(false);
function onStorageChanged(changes: Record<string, chrome.storage.StorageChange>, area: string) {
  const value = changes[STORAGE_KEYS.SETTINGS]?.newValue?.autoRecord;
  if (area === 'local' && typeof value === 'boolean') enabled.value = value;
}
onMounted(async () => {
  chrome.storage.onChanged.addListener(onStorageChanged);
  enabled.value = (await StorageManager.getSettings()).autoRecord;
});
onUnmounted(() => chrome.storage.onChanged.removeListener(onStorageChanged));
</script>

<template>
  <img :src="enabled ? '/icon-enabled-128.png' : '/icon-128.png'" width="32" height="32" alt="" class="brand-icon" />
</template>

<style scoped>
.brand-icon { display: inline-block; vertical-align: middle; flex-shrink: 0; }
</style>
