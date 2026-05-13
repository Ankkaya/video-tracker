<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  NCard, NInput, NButton, NSpace, NTag, NText, NList, NListItem,
  NThing, NEmpty, NInputGroup, NPopconfirm, useMessage,
} from 'naive-ui';
import type { CustomSite } from '../../shared/types';
import { api } from '../composables/useApi';
import { BUILTIN_SITES, isValidDomain } from '../utils/format';

const message = useMessage();
const customSites = ref<CustomSite[]>([]);
const newSiteDomain = ref('');

onMounted(loadSites);

async function loadSites() {
  const s = await api.getSettings();
  if (s) customSites.value = s.customSites ?? [];
}

async function addCustomSite() {
  const domain = newSiteDomain.value.trim().toLowerCase();
  if (!domain) return message.warning('请输入域名');
  if (!isValidDomain(domain)) return message.warning('请输入有效的域名（如 example.com）');
  if (customSites.value.some((s) => s.domain === domain))
    return message.warning('该站点已存在');
  if (BUILTIN_SITES.some((s) => s.domain === domain))
    return message.warning('该站点为内置站点，无需重复添加');

  const res = await api.addCustomSite(domain);
  if (res.success && res.customSites) {
    customSites.value = res.customSites;
    newSiteDomain.value = '';
    message.success(`已添加 ${domain}`);
  } else {
    message.error(res.error || '添加失败');
  }
}

async function removeCustomSite(domain: string) {
  const updated = await api.removeCustomSite(domain);
  if (updated) {
    customSites.value = updated;
    message.success('已删除');
  }
}
</script>

<template>
  <NSpace vertical :size="20">
    <NCard title="内置站点" size="small">
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
            <NTag type="success" :bordered="false" size="small">内置</NTag>
          </template>
        </NListItem>
      </NList>
    </NCard>

    <NCard title="自定义站点" size="small">
      <NText depth="3" style="display: block; margin-bottom: 12px; font-size: 13px">
        这里是通用自动识别的白名单。添加后，插件会在该域名下启用 iframe 探测和播放器对象桥接。
      </NText>
      <NInputGroup style="margin-bottom: 12px">
        <NInput
          v-model:value="newSiteDomain"
          placeholder="输入域名，如 example.com"
          @keydown.enter="addCustomSite"
        />
        <NButton type="primary" @click="addCustomSite">添加</NButton>
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
              确认删除该站点？
            </NPopconfirm>
          </template>
        </NListItem>
      </NList>
      <NEmpty v-else description="暂无自定义站点" style="padding: 24px 0" />
    </NCard>
  </NSpace>
</template>
