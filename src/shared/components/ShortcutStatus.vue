<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useManualShortcut } from '../composables/useManualShortcut';

defineProps<{ compact?: boolean }>();
const { t } = useI18n();
const { shortcut, status, openingFailed, settingsUrl, refresh, openSettings } = useManualShortcut();
</script>

<template>
  <section
    v-if="!compact || status === 'unassigned' || status === 'error'"
    class="shortcut-status"
    :class="{ warning: status === 'unassigned', compact }"
  >
    <div class="shortcut-heading">
      <span>{{ t('options.settings.shortcutLabel') }}</span>
      <kbd v-if="status === 'assigned'">{{ shortcut }}</kbd>
    </div>
    <p aria-live="polite">
      {{ t(`options.settings.${status === 'assigned' ? 'shortcutDesc' : status === 'unassigned' ? 'shortcutUnassigned' : status === 'error' ? 'shortcutReadFailed' : 'shortcutChecking'}`) }}
    </p>
    <p v-if="status === 'unassigned' && !compact">
      {{ t('options.settings.shortcutHelp') }}
    </p>
    <div class="shortcut-actions">
      <button type="button" @click="openSettings">{{ t('options.settings.shortcutConfigure') }}</button>
      <button v-if="status === 'error'" type="button" @click="refresh">{{ t('options.settings.shortcutRetry') }}</button>
    </div>
    <p v-if="openingFailed" role="alert">
      {{ t('options.settings.shortcutOpenFailed', { url: settingsUrl }) }}
    </p>
  </section>
</template>

<style scoped>
.shortcut-status { font-size: 13px; }
.shortcut-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; font-size: 15px; font-weight: 600; }
.shortcut-status p { margin: 6px 0 0; line-height: 1.6; opacity: 0.8; overflow-wrap: anywhere; }
.shortcut-actions { display: flex; gap: 12px; margin-top: 8px; }
.shortcut-actions button { font: inherit; color: #4361ee; border: 0; background: transparent; padding: 4px 0; cursor: pointer; text-align: left; }
.shortcut-actions button:hover { text-decoration: underline; }
.shortcut-actions button:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; border-radius: 2px; }
kbd { background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; padding: 4px 8px; font-size: 12px; font-family: monospace; }
.warning { border: 1px solid #e4ba70; background: #fff8eb; border-radius: 8px; padding: 12px; color: #704710; }
.compact { margin: 12px 16px 0; }
:global(html.dark) kbd { background: #333; border-color: #555; }
:global(html.dark) .warning { background: #352b1c; border-color: #735a31; color: #f0ce90; }
:global(html.dark) .shortcut-actions button { color: #a6b4ff; }
</style>
