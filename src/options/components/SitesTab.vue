<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { NCard, NInput, NButton, NSpace, NText, NList, NListItem, NThing, NInputGroup, useMessage } from 'naive-ui';
import type { SiteRule } from '../../shared/types';
import { api } from '../composables/useApi';
import { parseSiteDomain } from '../../shared/siteRules';
import { STORAGE_KEYS } from '../../shared/constants';

const { t } = useI18n();
const message = useMessage();
const rules = ref<SiteRule[]>([]);
const newDomain = ref('');
const saving = ref(false);
const domainPreview = computed(() => {
  try { return parseSiteDomain(newDomain.value); }
  catch { return ''; }
});
const excludedDomains = computed(() => rules.value.filter(rule => !rule.autoRecord).map(rule => rule.domain).sort());
async function load() {
  const settings = await api.getSettings();
  rules.value = settings?.siteRules ?? [];
}
async function setRule(domain: string, value: boolean) {
  if (saving.value) return false;
  saving.value = true;
  try {
    rules.value = await api.setSiteRule(domain, value);
    return true;
  }
  catch { message.error(t('options.sites.saveFailed')); return false; }
  finally { saving.value = false; }
}
async function addDomain() {
  if (saving.value) return;
  if (!newDomain.value.trim()) {
    message.warning(t('options.sites.validation.emptyDomain'));
    return;
  }
  let domain: string;
  try { domain = parseSiteDomain(newDomain.value); }
  catch { message.warning(t('options.sites.validation.invalidDomain')); return; }
  if (excludedDomains.value.includes(domain)) {
    message.info(t('options.sites.validation.alreadyAdded', { domain }));
    return;
  }
  if (await setRule(domain, false)) {
    newDomain.value = '';
    message.success(t('options.sites.addSuccess', { domain }));
  }
}
async function removeDomain(domain: string) {
  if (await setRule(domain, true)) message.success(t('options.sites.removeSuccess', { domain }));
}
function changed(changes: Record<string, chrome.storage.StorageChange>, area: string) {
  if (area === 'local' && changes[STORAGE_KEYS.SETTINGS]) void load();
}
onMounted(() => { chrome.storage.onChanged.addListener(changed); void load(); });
onUnmounted(() => chrome.storage.onChanged.removeListener(changed));
</script>

<template>
  <NSpace vertical :size="20">
    <NCard :title="t('options.sites.otherTitle')" size="small">
      <NText depth="3" style="display: block; margin-bottom: 12px">{{ t('options.sites.otherDesc') }}</NText>
      <NInputGroup>
        <NInput v-model:value="newDomain" :placeholder="t('options.sites.domainPlaceholder')" :disabled="saving" @keydown.enter="addDomain" />
        <NButton :loading="saving" @click="addDomain">{{ t('options.sites.add') }}</NButton>
      </NInputGroup>
      <NText v-if="domainPreview && domainPreview !== newDomain.trim()" depth="3" style="display: block; margin-top: 8px; overflow-wrap: anywhere">
        {{ t('options.sites.domainPreview', { domain: domainPreview }) }}
      </NText>
      <NList v-if="excludedDomains.length">
        <NListItem v-for="domain in excludedDomains" :key="domain">
          <NThing :title="domain"><template #avatar>🌐</template></NThing>
          <template #suffix>
            <NButton
              quaternary circle type="error" :disabled="saving"
              :title="t('options.sites.deleteSite', { domain })"
              :aria-label="t('options.sites.deleteSite', { domain })"
              @click="removeDomain(domain)"
            >
              <template #icon>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" />
                </svg>
              </template>
            </NButton>
          </template>
        </NListItem>
      </NList>
    </NCard>
  </NSpace>
</template>
