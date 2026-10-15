import { computed, onMounted, onUnmounted, ref } from 'vue';
import { MSG, STORAGE_KEYS } from '../../shared/constants';

export const FEATURE_TOUR_STEPS = [
  { tab: 'records', target: 'records', key: 'records' },
  { tab: 'settings', target: 'auto-record', key: 'autoRecord' },
  { tab: 'settings', target: 'threshold', key: 'threshold' },
  { tab: 'settings', target: 'shortcut', key: 'shortcut' },
] as const;

export interface FeatureTourState {
  step: number;
  status: 'active' | 'completed' | 'skipped';
}

function validState(value: unknown): value is FeatureTourState {
  if (!value || typeof value !== 'object') return false;
  const state = value as FeatureTourState;
  return Number.isInteger(state.step) && state.step >= 0 && state.step < FEATURE_TOUR_STEPS.length
    && ['active', 'completed', 'skipped'].includes(state.status);
}

export function useFeatureTour(navigate: (tab: 'records' | 'settings') => void, autoStart = true) {
  const state = ref<FeatureTourState | null>(null);
  const open = ref(false);
  const ready = ref(false);
  const busy = ref(false);
  const failed = ref(false);
  const step = computed(() => state.value?.step ?? 0);
  let disposed = false;

  function applyState(next: FeatureTourState) {
    state.value = next;
    open.value = next.status === 'active';
    if (open.value) navigate(FEATURE_TOUR_STEPS[next.step].tab);
  }

  async function save(next: FeatureTourState) {
    if (busy.value) return;
    busy.value = true;
    failed.value = false;
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.FEATURE_TOUR]: next });
      if (!disposed) applyState(next);
    } catch { failed.value = true; }
    finally { busy.value = false; }
  }

  async function load() {
    try {
      const stored = await chrome.storage.local.get([STORAGE_KEYS.FEATURE_TOUR]);
      if (disposed) return;
      const saved = stored[STORAGE_KEYS.FEATURE_TOUR];
      if (validState(saved)) {
        state.value = saved;
        if (autoStart) applyState(saved);
      } else if (autoStart) {
        const response = await chrome.runtime.sendMessage({ type: MSG.GET_ALL_RECORDS });
        if (!Array.isArray(response?.records) || response.error) throw new Error('Records unavailable');
        if (disposed) return;
        await save({ step: 0, status: response.records.length ? 'skipped' : 'active' });
      }
    } catch { failed.value = true; }
    finally { if (!disposed) ready.value = true; }
  }

  async function start() { if (ready.value) await save({ step: 0, status: 'active' }); }
  async function next() {
    if (!open.value || busy.value) return;
    if (step.value === FEATURE_TOUR_STEPS.length - 1) {
      await save({ step: step.value, status: 'completed' });
      if (!open.value && !disposed) navigate('records');
    } else { await save({ step: step.value + 1, status: 'active' }); }
  }
  async function previous() {
    if (open.value && step.value > 0) await save({ step: step.value - 1, status: 'active' });
  }
  async function skip() {
    if (open.value) await save({ step: step.value, status: 'skipped' });
  }

  function onStorageChanged(changes: Record<string, chrome.storage.StorageChange>, area: string) {
    const saved = changes[STORAGE_KEYS.FEATURE_TOUR]?.newValue;
    // Keep an open walkthrough in sync with other extension pages, without opening one unexpectedly.
    if (area === 'local' && open.value && validState(saved)) applyState(saved);
  }
  onMounted(() => {
    chrome.storage.onChanged.addListener(onStorageChanged);
    void load();
  });
  onUnmounted(() => {
    disposed = true;
    chrome.storage.onChanged.removeListener(onStorageChanged);
  });
  return { open, ready, busy, failed, step, start, next, previous, skip };
}
