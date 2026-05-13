<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  NConfigProvider,
  NMessageProvider,
  NDialogProvider,
  NTabs,
  NTabPane,
  NLayout,
  NLayoutHeader,
  NLayoutContent,
  NLayoutFooter,
  NH1,
  NText,
  NSpace,
} from 'naive-ui';
import type { GlobalThemeOverrides } from 'naive-ui';
import RecordsTab from './components/RecordsTab.vue';
import SettingsTab from './components/SettingsTab.vue';
import SitesTab from './components/SitesTab.vue';

type TabId = 'records' | 'settings' | 'sites';

const activeTab = ref<TabId>('records');
const recordsRef = ref<InstanceType<typeof RecordsTab> | null>(null);

watch(activeTab, (tab) => {
  if (tab === 'records') recordsRef.value?.reload();
});

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#4361ee',
    primaryColorHover: '#3451de',
    primaryColorPressed: '#2941c5',
    primaryColorSuppl: '#4361ee',
    borderRadius: '8px',
  },
};
</script>

<template>
  <NConfigProvider :theme-overrides="themeOverrides">
    <NMessageProvider>
      <NDialogProvider>
        <NLayout class="options-layout">
          <NLayoutHeader bordered class="options-header">
            <NH1 style="margin: 0">📹 VideoTracker</NH1>
            <NText depth="3">管理你的视频观看记录和插件设置</NText>
          </NLayoutHeader>

          <NLayoutContent content-style="padding: 24px 32px 80px;">
            <NTabs
              v-model:value="activeTab"
              type="segment"
              size="large"
              animated
              style="margin-bottom: 16px"
            >
              <NTabPane name="records" tab="📋 记录管理">
                <RecordsTab ref="recordsRef" />
              </NTabPane>
              <NTabPane name="settings" tab="⚙️ 插件设置">
                <SettingsTab />
              </NTabPane>
              <NTabPane name="sites" tab="🌐 站点管理">
                <SitesTab />
              </NTabPane>
            </NTabs>
          </NLayoutContent>

          <NLayoutFooter bordered position="absolute" style="text-align: center; padding: 12px;">
            <NText depth="3" style="font-size: 12px">
              VideoTracker v0.1.0 · 自动记录你的视频观看进度
            </NText>
          </NLayoutFooter>
        </NLayout>
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style>
.options-layout { min-height: 100vh; }
.options-header { padding: 20px 32px; }
</style>
