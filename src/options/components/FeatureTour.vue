<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { FEATURE_TOUR_STEPS } from '../composables/useFeatureTour';

const props = defineProps<{ step: number; busy: boolean; failed: boolean }>();
const emit = defineEmits<{ next: []; previous: []; skip: [] }>();
const { t } = useI18n();
const current = computed(() => FEATURE_TOUR_STEPS[props.step]);
const panel = ref<HTMLElement | null>(null);
const located = ref(false);
const box = ref({ left: 0, top: 0, width: 0, height: 0 });
const highlightRadius = ref(10);
const position = ref({ left: 16, top: 16 });
const pointer = ref({ left: 16, top: 16 });
const viewport = ref({ width: window.innerWidth, height: window.innerHeight });
const placement = ref<'above' | 'below' | 'floating'>('below');
let target: HTMLElement | null = null;
let frame = 0;
let disposed = false;
let observer: MutationObserver | undefined;
let resizeObserver: ResizeObserver | undefined;
const previousFocus = document.activeElement as HTMLElement | null;

const maskPath = computed(() => {
  const { width, height } = viewport.value;
  const outer = `M0 0H${width}V${height}H0Z`;
  if (!located.value) return outer;
  const { left: x, top: y, width: w, height: h } = box.value;
  const r = highlightRadius.value;
  // The mask and outline share one rounded boundary, including the padded corners.
  return `${outer} M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}`
    + `V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}`
    + `H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}`
    + `V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
});
function styleRect(rect: { left: number; top: number; width?: number; height?: number }) {
  return Object.fromEntries(Object.entries(rect).map(([key, value]) => [key, `${value}px`]));
}

function updatePosition() {
  viewport.value = { width: window.innerWidth, height: window.innerHeight };
  const candidate = document.querySelector<HTMLElement>(`[data-tour="${current.value.target}"]`);
  if (candidate !== target) {
    resizeObserver?.disconnect();
    target = candidate;
    if (target) resizeObserver?.observe(target);
    if (panel.value) resizeObserver?.observe(panel.value);
  }
  located.value = !!target;
  const vw = viewport.value.width;
  const vh = viewport.value.height;
  const tipWidth = panel.value?.offsetWidth ?? Math.min(360, vw - 32);
  const tipHeight = panel.value?.offsetHeight ?? 230;
  if (!target) {
    placement.value = 'floating';
    position.value = { left: Math.max(16, (vw - tipWidth) / 2), top: Math.max(16, (vh - tipHeight) / 2) };
    return;
  }
  const rect = target.getBoundingClientRect();
  const left = Math.max(8, rect.left - 6);
  const top = Math.max(8, Math.min(vh - 8, rect.top - 6));
  const right = Math.max(left, Math.min(vw - 8, rect.right + 6));
  const bottom = Math.max(top, Math.min(vh - 8, rect.bottom + 6));
  box.value = { left, top, width: right - left, height: bottom - top };
  const targetRadius = parseFloat(getComputedStyle(target).borderTopLeftRadius) || 0;
  highlightRadius.value = Math.min(targetRadius + 6, (right - left) / 2, (bottom - top) / 2);
  let tipTop: number;
  if (bottom + 14 + tipHeight <= vh - 16) {
    placement.value = 'below'; tipTop = bottom + 14;
  } else if (top - 14 - tipHeight >= 16) {
    placement.value = 'above'; tipTop = top - 14 - tipHeight;
  } else {
    placement.value = 'floating'; tipTop = Math.max(16, vh - tipHeight - 16);
  }
  position.value = {
    left: Math.max(16, Math.min(vw - tipWidth - 16, left)),
    top: tipTop,
  };
  pointer.value = { left: position.value.left + 26,
    top: placement.value === 'below' ? tipTop - 5 : tipTop + tipHeight - 7 };
}

function schedulePosition() {
  if (disposed || frame) return;
  frame = requestAnimationFrame(() => { frame = 0; updatePosition(); });
}

async function focusStep() {
  await nextTick();
  if (disposed) return;
  target = document.querySelector<HTMLElement>(`[data-tour="${current.value.target}"]`);
  const rect = target?.getBoundingClientRect();
  if (rect && (rect.top < 16 || rect.bottom > window.innerHeight - 16)) {
    target?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }
  resizeObserver?.disconnect();
  if (target) resizeObserver?.observe(target);
  if (panel.value) resizeObserver?.observe(panel.value);
  updatePosition();
  panel.value?.focus({ preventScroll: true });
}

function onKeydown(event: KeyboardEvent) {
  if (event.defaultPrevented) return;
  // A select menu owns Escape and keyboard navigation while it is open.
  if (document.querySelector('.n-base-select-menu')) return;
  if (event.key === 'Escape') { event.preventDefault(); emit('skip'); }
  if (event.key !== 'Tab') return;
  const selector = 'button:not([disabled]), input:not([disabled]), [tabindex="0"]';
  const controls = [
    ...Array.from(target?.querySelectorAll<HTMLElement>(selector) ?? []),
    ...Array.from(panel.value?.querySelectorAll<HTMLElement>(selector) ?? []),
  ].filter(el => el.getClientRects().length && el.getAttribute('aria-disabled') !== 'true');
  if (!controls.length) return;
  const index = controls.indexOf(document.activeElement as HTMLElement);
  const next = event.shiftKey ? (index <= 0 ? controls.length - 1 : index - 1) : (index + 1) % controls.length;
  event.preventDefault(); controls[next].focus();
}

watch(() => props.step, () => { void focusStep(); });
onMounted(() => {
  resizeObserver = new ResizeObserver(schedulePosition);
  observer = new MutationObserver(schedulePosition);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', schedulePosition);
  window.addEventListener('scroll', schedulePosition, true);
  document.addEventListener('keydown', onKeydown);
  void focusStep();
});
onUnmounted(() => {
  disposed = true;
  cancelAnimationFrame(frame);
  observer?.disconnect(); resizeObserver?.disconnect();
  window.removeEventListener('resize', schedulePosition);
  window.removeEventListener('scroll', schedulePosition, true);
  document.removeEventListener('keydown', onKeydown);
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
});
</script>

<template>
  <Teleport to="body">
    <div class="feature-tour" :data-step="step">
      <svg class="tour-mask" :viewBox="`0 0 ${viewport.width} ${viewport.height}`" aria-hidden="true">
        <path class="tour-mask-path" :d="maskPath" fill-rule="evenodd" />
      </svg>
      <div v-if="located" class="tour-highlight" :style="{ ...styleRect(box), borderRadius: `${highlightRadius}px` }" aria-hidden="true" />
      <div v-if="located && placement !== 'floating'" class="tour-pointer" :class="placement" :style="styleRect(pointer)" aria-hidden="true" />
      <section ref="panel" class="tour-panel" :class="`tour-${placement}`" :style="styleRect(position)"
        role="dialog" aria-labelledby="feature-tour-title" aria-describedby="feature-tour-description" tabindex="-1">
        <div class="tour-topline">
          <span>{{ t('featureTour.progress', { current: step + 1, total: FEATURE_TOUR_STEPS.length }) }}</span>
          <button class="tour-close" :disabled="busy" :aria-label="t('featureTour.skip')" @click="emit('skip')">×</button>
        </div>
        <h2 id="feature-tour-title">{{ t(`featureTour.steps.${current.key}.title`) }}</h2>
        <p id="feature-tour-description">{{ t(`featureTour.steps.${current.key}.description`) }}</p>
        <p v-if="step === 1 || step === 2" class="tour-hint">{{ t('featureTour.tryControl') }}</p>
        <p v-if="!located" class="tour-hint" role="status">{{ t('featureTour.locating') }}</p>
        <p v-if="failed" class="tour-error" role="alert">{{ t('featureTour.saveFailed') }}</p>
        <div class="tour-dots" aria-hidden="true"><span v-for="(_, index) in FEATURE_TOUR_STEPS" :key="index" :class="{ current: index === step, done: index < step }" /></div>
        <div class="tour-actions">
          <button class="tour-skip" :disabled="busy" @click="emit('skip')">{{ t('featureTour.skip') }}</button>
          <div>
            <button v-if="step > 0" class="tour-back" :disabled="busy" @click="emit('previous')">{{ t('featureTour.previous') }}</button>
            <button class="tour-next" :disabled="busy || !located" @click="emit('next')">{{ t(step === FEATURE_TOUR_STEPS.length - 1 ? 'featureTour.finish' : 'featureTour.next') }}</button>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.feature-tour { --tour-surface: #fff; --tour-border: #dce3f7; }
.tour-mask { position: fixed; inset: 0; width: 100%; height: 100%; z-index: 1500; pointer-events: none; }
.tour-mask-path { fill: rgba(12, 20, 39, .5); pointer-events: visiblePainted; }
.tour-highlight { position: fixed; z-index: 1501; pointer-events: none; border: 2px solid #8da4ff; box-shadow: 0 0 0 3px rgba(114, 143, 255, .18); box-sizing: border-box; }
.tour-pointer { position: fixed; z-index: 1503; pointer-events: none; width: 12px; height: 12px; background: var(--tour-surface); transform: rotate(45deg); }
.tour-pointer.below { border-top: 1px solid var(--tour-border); border-left: 1px solid var(--tour-border); }
.tour-pointer.above { border-bottom: 1px solid var(--tour-border); border-right: 1px solid var(--tour-border); }
.tour-panel { position: fixed; z-index: 1502; box-sizing: border-box; width: min(360px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow-y: auto; padding: 20px; border: 1px solid var(--tour-border); border-radius: 14px; background: var(--tour-surface); color: #202940; box-shadow: 0 16px 48px rgba(8, 16, 40, .24); font-family: "Segoe UI", "Microsoft YaHei", sans-serif; outline: none; }
.tour-topline { display: flex; justify-content: space-between; align-items: center; color: #66748d; font-size: 12px; }
.tour-close { border: 0; background: transparent; color: inherit; font-size: 22px; line-height: 1; padding: 2px 4px; }
h2 { margin: 12px 0 8px; font-size: 18px; line-height: 1.5; color: inherit; }
p { margin: 0; font-size: 13px; line-height: 1.8; color: #526079; }
.tour-hint { margin-top: 10px; font-size: 12px; color: #4361ee; }
.tour-error { margin-top: 8px; color: #b73030; }
.tour-dots { display: flex; gap: 6px; margin: 18px 0; }
.tour-dots span { width: 7px; height: 7px; border-radius: 50%; background: #e0e5f2; }
.tour-dots span.current { width: 20px; border-radius: 6px; background: #4361ee; }
.tour-dots span.done { background: #a0b1f8; }
.tour-actions, .tour-actions > div { display: flex; align-items: center; gap: 8px; }
.tour-actions { justify-content: space-between; }
button { cursor: pointer; font: inherit; }
button:disabled { cursor: wait; opacity: .55; }
button:focus-visible { outline: 2px solid #4361ee; outline-offset: 3px; }
.tour-skip { padding: 7px 0; background: transparent; border: 0; color: #66748d; font-size: 12px; }
.tour-back, .tour-next { padding: 8px 12px; border-radius: 7px; font-size: 12px; font-weight: 600; }
.tour-back { border: 1px solid #dce3f7; background: #fff; color: #526079; }
.tour-next { border: 1px solid #4361ee; background: #4361ee; color: #fff; }
.tour-next:hover { background: #3451de; }
</style>

<style>
html.dark .feature-tour { --tour-surface: #25283c; --tour-border: #454d6a; }
html.dark .tour-panel { color: #f1f4ff; }
html.dark .tour-panel p, html.dark .tour-topline, html.dark .tour-skip { color: #bac5db; }
html.dark .tour-panel .tour-hint { color: #a7b8ff; }
html.dark .tour-panel .tour-error { color: #ffadb4; }
html.dark .tour-back { background: transparent; border-color: #535c79; color: #dbe4fc; }
</style>
