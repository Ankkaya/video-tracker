<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useManualShortcut } from '../composables/useManualShortcut';

defineProps<{ compact?: boolean }>();
const { t } = useI18n();
const { shortcut, status, openingFailed, settingsUrl, openSettings } = useManualShortcut();
const defaultShortcut = /Mac/i.test(navigator.userAgent) ? 'Command+Shift+V' : 'Ctrl+Shift+V';
const keys = computed(() => (shortcut.value || defaultShortcut).split('+'));
</script>

<template>
  <section class="shortcut-status" :class="{ compact }">
    <div class="shortcut-row">
      <div class="shortcut-copy">
        <div class="shortcut-heading">{{ t('options.settings.shortcutLabel') }}</div>
        <p>{{ t('options.settings.shortcutDesc') }}</p>
      </div>
      <div class="shortcut-controls">
        <div class="shortcut-keys" :class="{ muted: status === 'unassigned' || status === 'error' }">
          <template v-for="(key, index) in keys" :key="index">
            <span v-if="index" aria-hidden="true">+</span>
            <kbd>{{ key }}</kbd>
          </template>
        </div>
        <button type="button" @click="openSettings">{{ t('options.settings.shortcutModify') }}</button>
      </div>
    </div>
    <p v-if="openingFailed" class="shortcut-warning" role="alert">
      {{ t('options.settings.shortcutOpenFailed', { url: settingsUrl }) }}
    </p>
    <p v-else-if="status === 'unassigned' || status === 'error'" class="shortcut-warning" role="status">
      {{ t(status === 'unassigned' ? 'options.settings.shortcutUnavailable' : 'options.settings.shortcutCheckFailed') }}
    </p>
  </section>
</template>

<style scoped>
.shortcut-status { font-size: 13px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px 24px; }
.shortcut-row { display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
.shortcut-copy { min-width: 0; }
.shortcut-heading { font-size: 15px; font-weight: 600; }
.shortcut-status p { margin: 6px 0 0; line-height: 1.6; overflow-wrap: anywhere; }
.shortcut-copy p { opacity: 0.65; }
.shortcut-controls, .shortcut-keys { display: flex; align-items: center; gap: 10px; }
.shortcut-controls { gap: 24px; flex-wrap: wrap; }
.shortcut-keys { white-space: nowrap; }
.shortcut-keys > span { opacity: 0.5; }
.shortcut-keys.muted { opacity: 0.5; }
button { font: inherit; color: #4361ee; border: 0; background: transparent; padding: 4px 0; cursor: pointer; }
button:hover { text-decoration: underline; }
button:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; border-radius: 2px; }
kbd { background: #f5f5f6; border: 1px solid #ddd; border-radius: 6px; padding: 7px 12px; font-size: 13px; font-family: inherit; }
.shortcut-status .shortcut-warning { margin-top: 12px; color: #9b6900; text-align: right; }
.compact { margin: 12px 16px 0; }
html.dark .shortcut-status { border-color: #35353d; }
html.dark kbd { background: #27272d; border-color: #3b3b44; }
html.dark .shortcut-warning { color: #f0c45c; }
html.dark button { color: #a6b4ff; }
@media (max-width: 480px) {
  .shortcut-status { padding: 16px; }
  .shortcut-controls { width: 100%; justify-content: space-between; gap: 12px; }
}
</style>
