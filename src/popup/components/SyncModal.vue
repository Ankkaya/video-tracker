<script setup lang="ts">
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { NButton, NText, NTag } from 'naive-ui';
import { useAuth } from '../../options/composables/useAuth';
import { useSync } from '../../options/composables/useSync';
import { api } from '../../options/composables/useApi';

const emit = defineEmits<{
  message: [text: string, type: 'success' | 'error' | 'info']
}>();

const { t } = useI18n();
const { isLoggedIn } = useAuth();
const { isSyncing, syncMeta, loadSyncMeta, syncRecords } = useSync();

const show = defineModel<boolean>('show', { default: false });

const syncStatus = computed(() => {
  if (!isLoggedIn.value) return 'not-logged-in';
  if (isSyncing.value || syncMeta.value.state === 'syncing') return 'syncing';
  if (syncMeta.value.state === 'error') return 'error';
  if (syncMeta.value.lastSyncAt) return 'synced';
  return 'not-synced';
});

const lastSyncTime = computed(() => (
  syncMeta.value.lastSyncAt ? new Date(syncMeta.value.lastSyncAt).toLocaleString() : ''
));

watch(show, (visible) => {
  if (visible) {
    void loadSyncMeta();
  }
});

function getSyncStatusText() {
  switch (syncStatus.value) {
    case 'not-logged-in':
      return t('popup.sync.notLoggedIn');
    case 'not-synced':
      return t('popup.sync.notSynced');
    case 'synced':
      return t('popup.sync.synced');
    case 'syncing':
      return t('popup.sync.syncing');
    case 'error':
      return t('popup.sync.syncFailed');
  }
}

function getSyncStatusType() {
  switch (syncStatus.value) {
    case 'not-logged-in':
    case 'not-synced':
      return 'default';
    case 'synced':
      return 'success';
    case 'syncing':
      return 'warning';
    case 'error':
      return 'error';
  }
}

async function handleSync() {
  if (!isLoggedIn.value) {
    close();
    chrome.tabs.create({ url: chrome.runtime.getURL('/options.html?login=true') });
    return;
  }

  const localRecords = await api.getRecords();
  const result = await syncRecords(localRecords || []);
  if (result.success) {
    emit('message', t('popup.sync.syncSuccess'), 'success');
  } else {
    emit('message', result.error || t('popup.sync.syncFailed'), 'error');
  }
}

function close() {
  show.value = false;
}

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    close();
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="modal-backdrop" @click="onBackdropClick">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>{{ t('popup.sync.title') }}</h3>
            <button class="close-btn" @click="close">×</button>
          </div>
          <div class="modal-body">
            <div class="modal-section">
              <NText depth="3" style="font-size: 13px">
                {{ t('popup.sync.description') }}
              </NText>
            </div>

            <div class="modal-row">
              <NText depth="3" style="font-size: 13px">
                {{ t('options.settings.syncStatus') }}
              </NText>
              <NTag :type="getSyncStatusType()">{{ getSyncStatusText() }}</NTag>
            </div>

            <div v-if="lastSyncTime" class="modal-row">
              <NText depth="3" style="font-size: 13px">
                {{ t('popup.sync.lastSync') }}
              </NText>
              <NText depth="3" style="font-size: 13px">
                {{ lastSyncTime }}
              </NText>
            </div>

            <div v-if="syncMeta.lastError" class="modal-error">
              {{ syncMeta.lastError }}
            </div>

            <div class="modal-actions">
              <NButton type="primary" @click="handleSync" :loading="isSyncing" block>
                {{ isLoggedIn ? t('popup.sync.syncNow') : t('popup.sync.login') }}
              </NButton>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 320px;
  max-width: 90vw;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e8e8e8;
}

.modal-header h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: #1a1a2e;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #333;
}

.modal-body {
  padding: 20px;
}

.modal-section {
  margin-bottom: 16px;
}

.modal-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.modal-error {
  margin-bottom: 16px;
  padding: 8px 10px;
  border: 1px solid #ffc9c9;
  border-radius: 6px;
  background: #fff5f5;
  color: #c92a2a;
  font-size: 12px;
  line-height: 1.4;
}

.modal-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 20px;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.2s ease;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.95);
}

</style>

<style>
/* Dark mode styles (unscoped so html.dark ancestor selector works) */
html.dark .modal-content {
  background: #1a1a2e;
}

html.dark .modal-header {
  border-bottom: 1px solid #2d2d44;
}

html.dark .modal-header h3 {
  color: #fff;
}

html.dark .close-btn {
  color: #888;
}

html.dark .close-btn:hover {
  color: #fff;
}

html.dark .modal-error {
  background: rgba(201, 42, 42, 0.14);
  border-color: rgba(255, 135, 135, 0.3);
  color: #ff8787;
}
</style>
