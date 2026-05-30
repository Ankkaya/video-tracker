<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  NCard, NInput, NButton, NSpace, NTag, NText, NList, NListItem,
  NThing, NEmpty, NInputGroup, NPopconfirm, useMessage,
} from 'naive-ui';
import type { CustomSite } from '../../shared/types';
import { api } from '../composables/useApi';
import { BUILTIN_SITES, isValidDomain } from '../utils/format';
import { STORAGE_KEYS } from '../../shared/constants';

const { t } = useI18n();
const message = useMessage();

const customSites = ref<CustomSite[]>([]);
const newSiteDomain = ref('');

onMounted(loadSites);
onMounted(() => {
  chrome.storage.onChanged.addListener(onStorageChanged);
});

onUnmounted(() => {
  chrome.storage.onChanged.removeListener(onStorageChanged);
});

function onStorageChanged(changes: Record<string, chrome.storage.StorageChange>, areaName: string) {
  if (areaName === 'local' && changes[STORAGE_KEYS.SETTINGS]) {
    void loadSites();
  }
}

async function loadSites() {
  const s = await api.getSettings();
  if (s) customSites.value = s.customSites ?? [];
}

async function addCustomSite() {
  const domain = newSiteDomain.value.trim().toLowerCase();
  if (!domain) return message.warning(t('options.sites.validation.emptyDomain'));
  if (!isValidDomain(domain)) return message.warning(t('options.sites.validation.invalidDomain'));
  if (customSites.value.some((s) => s.domain === domain))
    return message.warning(t('options.sites.validation.siteExists'));
  if (BUILTIN_SITES.some((s) => s.domain === domain))
    return message.warning(t('options.sites.validation.builtinSite'));

  const res = await api.addCustomSite(domain);
  if (res.success && res.customSites) {
    customSites.value = res.customSites;
    newSiteDomain.value = '';
    message.success(t('options.sites.addSuccess', { domain }));
  } else {
    message.error(res.error || t('options.sites.addFailed'));
  }
}

async function removeCustomSite(domain: string) {
  const updated = await api.removeCustomSite(domain);
  if (updated) {
    customSites.value = updated;
    message.success(t('options.sites.deleteSuccess'));
  }
}

</script>

<template>
  <NSpace vertical :size="20">
    <NCard :title="t('options.sites.builtinTitle')" size="small">
      <NList hoverable>
        <NListItem v-for="site in BUILTIN_SITES" :key="site.domain">
          <NThing>
            <template #avatar>
              <span style="font-size: 20px">{{ site.icon }}</span>
            </template>
            <template #header>{{ site.name }}</template>
            <template #description>
              <NText depth="3">{{ site.domain }}</NText>
            </template>
          </NThing>
          <template #suffix>
            <NTag type="success" :bordered="false" size="small">{{ t('common.builtin') }}</NTag>
          </template>
        </NListItem>
      </NList>
    </NCard>

    <NCard :title="t('options.sites.customTitle')" size="small">
      <NText depth="3" style="display: block; margin-bottom: 12px; font-size: 13px">
        {{ t('options.sites.customDesc') }}
      </NText>
      <NInputGroup style="margin-bottom: 12px">
        <NInput
          v-model:value="newSiteDomain"
          :placeholder="t('options.sites.domainPlaceholder')"
          @keydown.enter="addCustomSite"
        />
        <NButton type="primary" @click="addCustomSite">{{ t('options.sites.add') }}</NButton>
      </NInputGroup>

      <NList v-if="customSites.length > 0" hoverable>
        <NListItem v-for="site in customSites" :key="site.domain">
          <NThing>
            <template #avatar>
              <span style="font-size: 20px">🌐</span>
            </template>
            <template #header>{{ site.domain }}</template>
          </NThing>
          <template #suffix>
            <NPopconfirm @positive-click="removeCustomSite(site.domain)">
              <template #trigger>
                <NButton size="small" quaternary type="error">✕</NButton>
              </template>
              {{ t('options.sites.confirmDelete') }}
            </NPopconfirm>
          </template>
        </NListItem>
      </NList>
      <NEmpty v-else :description="t('options.sites.emptyDescription')" style="padding: 24px 0" />
    </NCard>
  </NSpace>
</template>
