<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { NCard, NInput, NButton, NSpace, NText, NList, NListItem, NThing, NInputGroup, NSwitch, useMessage } from 'naive-ui';
import type { SiteRule, WatchRecord } from '../../shared/types';
import { api } from '../composables/useApi';
import { BUILTIN_SITES } from '../utils/format';
import { normalizeDomain, isSiteAutoRecordEnabled } from '../../shared/siteRules';
import { STORAGE_KEYS } from '../../shared/constants';

const { t } = useI18n();
const message = useMessage();
const rules = ref<SiteRule[]>([]);
const records = ref<WatchRecord[]>([]);
const newDomain = ref('');
const saving = ref(false);
const otherDomains = computed(() => {
  const domains = new Set(rules.value.map(r => r.domain));
  for (const record of records.value) {
    try {
      const domain = new URL(record.url).hostname;
      if (!BUILTIN_SITES.some(s => domain === s.domain || domain.endsWith('.' + s.domain))) domains.add(domain);
    } catch {}
  }
  return [...domains].filter(domain => !BUILTIN_SITES.some(s => domain === s.domain) && enabled(domain)).sort();
});
function enabled(domain: string) { return isSiteAutoRecordEnabled('https://' + domain, rules.value); }
async function load() {
  const [settings, saved] = await Promise.all([api.getSettings(), api.getRecords()]);
  rules.value = settings?.siteRules ?? [];
  records.value = saved;
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
  let domain: string;
  try { domain = normalizeDomain(newDomain.value); }
  catch { message.warning(t('options.sites.validation.invalidDomain')); return; }
  if (await setRule(domain, true)) newDomain.value = '';
}
function changed(changes: Record<string, chrome.storage.StorageChange>, area: string) {
  if (area === 'local' && (changes[STORAGE_KEYS.SETTINGS] || changes[STORAGE_KEYS.RECORDS])) void load();
}
onMounted(() => { chrome.storage.onChanged.addListener(changed); void load(); });
onUnmounted(() => chrome.storage.onChanged.removeListener(changed));
</script>

<template>
  <NSpace vertical :size="20">
    <NText depth="3">{{ t('options.sites.description') }}</NText>
    <NCard :title="t('options.sites.builtinTitle')" size="small">
      <NList>
        <NListItem v-for="site in BUILTIN_SITES" :key="site.domain">
          <NThing :title="t(`popup.platforms.${site.platform}`)" :description="site.domain">
            <template #avatar><img :src="site.icon" alt="" width="32" height="32" class="site-icon" /></template>
          </NThing>
          <template #suffix><NSwitch :value="enabled(site.domain)" :disabled="saving" :aria-label="t('options.sites.autoRecordFor', { domain: site.domain })" @update:value="setRule(site.domain, $event)" /></template>
        </NListItem>
      </NList>
    </NCard>
    <NCard :title="t('options.sites.otherTitle')" size="small">
      <NText depth="3" style="display: block; margin-bottom: 12px">{{ t('options.sites.otherDesc') }}</NText>
      <NInputGroup>
        <NInput v-model:value="newDomain" :placeholder="t('options.sites.domainPlaceholder')" :disabled="saving" @keydown.enter="addDomain" />
        <NButton :loading="saving" @click="addDomain">{{ t('options.sites.add') }}</NButton>
      </NInputGroup>
      <NList v-if="otherDomains.length">
        <NListItem v-for="domain in otherDomains" :key="domain">
          <NThing :title="domain"><template #avatar>🌐</template></NThing>
          <template #suffix>
            <NButton
              quaternary circle type="error" :disabled="saving"
              :title="t('options.sites.deleteSite', { domain })"
              :aria-label="t('options.sites.deleteSite', { domain })"
              @click="setRule(domain, false)"
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

<style scoped>
.site-icon { display: block; object-fit: contain; }
</style>
