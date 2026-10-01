import { ref, onMounted, onUnmounted } from 'vue';
import type { CustomSite } from '../types';
import { MSG, STORAGE_KEYS } from '../constants';

export function useCustomSites() {
  const customSites = ref<CustomSite[]>([]);
  async function load() {
    const response = await chrome.runtime.sendMessage({ type: MSG.GET_SETTINGS });
    customSites.value = response?.settings?.customSites ?? [];
  }
  function changed(changes: Record<string, chrome.storage.StorageChange>, area: string) {
    if (area === 'local' && changes[STORAGE_KEYS.SETTINGS]) void load();
  }
  onMounted(() => {
    chrome.storage.onChanged.addListener(changed);
    void load();
  });
  onUnmounted(() => chrome.storage.onChanged.removeListener(changed));
  return customSites;
}
