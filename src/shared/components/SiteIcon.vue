<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { getSiteBrand } from '../siteBrand';

const props = defineProps<{ url: string; platform: string }>();
const brand = computed(() => getSiteBrand(props));
const failed = ref(false);
watch(() => brand.value?.icon, () => { failed.value = false; });
</script>

<template>
  <span class="site-icon" :style="brand ? { '--site-color': brand.color } : undefined" aria-hidden="true">
    <img v-if="brand && !failed" :src="brand.icon" alt="" @error="failed = true" />
    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
      <rect x="3" y="4" width="18" height="16" rx="4" />
      <path d="m10 8 6 4-6 4Z" fill="currentColor" stroke="none" />
    </svg>
  </span>
</template>

<style scoped>
.site-icon {
  --site-color: #64748b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  color: var(--site-color);
  background: color-mix(in srgb, var(--site-color) 10%, transparent);
}
.site-icon img, .site-icon svg { display: block; width: 28px; height: 28px; object-fit: contain; }
</style>
