<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { NButton, NCard, NInput, NText, useDialog, useMessage } from 'naive-ui';
import { useAuth } from '../composables/useAuth';
import { useFeedback } from '../composables/useFeedback';
import { FEEDBACK_CONSENT_KEY, FEEDBACK_CONSENT_VERSION, FEEDBACK_ISSUES_URL, FEEDBACK_TEXT_LIMIT, feedbackCharacterCount } from '../../shared/feedback';
import GitHubIcon from '../../shared/components/GitHubIcon.vue';

const { t } = useI18n();
const dialog = useDialog();
const message = useMessage();
const { user, isLoggedIn } = useAuth();
const accountEmail = computed(() => isLoggedIn.value ? user.value?.email ?? '' : '');
const { content, email, image, previewUrl, imageError, error, busy, selectingImage, count, canSubmit, editEmail, selectImage, removeImage, validate, submit } = useFeedback(accountEmail);
const picker = ref<HTMLInputElement | null>(null);
let accepted = false;
let confirmationOpen = false;
onMounted(async () => {
  try { const stored = await chrome.storage.local.get(FEEDBACK_CONSENT_KEY); accepted = stored[FEEDBACK_CONSENT_KEY] === FEEDBACK_CONSENT_VERSION; } catch { /* Ask on submit if consent storage is unavailable. */ }
});
async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const selected = input.files?.[0];
  input.value = '';
  if (selected) await selectImage(selected);
}
async function send() { if (await submit()) message.success(t('options.feedback.success')); }
function handleSubmit() {
  if (busy.value || confirmationOpen || !validate()) return;
  if (accepted) { void send(); return; }
  confirmationOpen = true;
  dialog.create({
    title: t('options.feedback.consentTitle'),
    content: () => h('div', [h('p', { style: { margin: '0 0 12px' } }, t('options.feedback.consentDescription')), h('a', { href: chrome.runtime.getURL('/privacy-policy.html'), target: '_blank', rel: 'noopener noreferrer', style: { color: '#4361ee' } }, t('options.feedback.privacy'))]),
    positiveText: t('options.feedback.agreeSubmit'), negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      accepted = true;
      try { await chrome.storage.local.set({ [FEEDBACK_CONSENT_KEY]: FEEDBACK_CONSENT_VERSION }); } catch { /* This confirmation remains valid for the current page. */ }
      confirmationOpen = false;
      void send();
    },
    onAfterLeave: () => { confirmationOpen = false; },
  });
}
</script>

<template>
  <section class="feedback-page">
    <NCard class="feedback-card" :bordered="true">
      <form class="feedback-form" @submit.prevent="handleSubmit">
        <NInput v-model:value="content" type="textarea" :maxlength="FEEDBACK_TEXT_LIMIT" :count-graphemes="feedbackCharacterCount" :placeholder="''" :disabled="busy" :autosize="{ minRows: 7 }" :input-props="{ 'aria-label': t('options.feedback.content'), 'aria-describedby': 'feedback-count' }" />
        <div id="feedback-count" class="feedback-count"><NText depth="3">{{ count }}/{{ FEEDBACK_TEXT_LIMIT }}</NText></div>
        <div class="feedback-upload">
          <NButton :disabled="busy || selectingImage" :loading="selectingImage" @click="picker?.click()"><template #icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6"/></svg></template>{{ t('options.feedback.uploadImage') }}</NButton>
          <NText depth="3" class="feedback-image-limit">{{ image ? '1/1' : '0/1' }} · {{ t('options.feedback.imageLimit') }}</NText>
          <input ref="picker" class="feedback-file" type="file" accept="image/png,image/jpeg,image/webp" :aria-label="t('options.feedback.uploadImage')" @change="onFileChange">
        </div>
        <p v-if="imageError" class="feedback-error" role="alert">{{ t(`options.feedback.errors.${imageError}`) }}</p>
        <div v-if="image" class="feedback-image"><img :src="previewUrl" :alt="t('options.feedback.imagePreview')"><NButton quaternary circle :disabled="busy" :aria-label="t('options.feedback.removeImage')" @click="removeImage"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></NButton></div>
        <div class="feedback-email"><label for="feedback-email">{{ t('options.feedback.email') }}</label><NInput id="feedback-email" :value="email" :placeholder="t('options.feedback.emailPlaceholder')" :disabled="busy" :maxlength="254" clearable :input-props="{ type: 'email', autocomplete: 'email', 'aria-label': t('options.feedback.email') }" @update:value="editEmail" /></div>
        <p v-if="error" class="feedback-error" role="alert">{{ t(`options.feedback.errors.${error}`) }}</p>
        <div class="feedback-actions"><NButton type="primary" :disabled="!canSubmit" :loading="busy" @click="handleSubmit">{{ t('options.feedback.submit') }}</NButton></div>
      </form>
    </NCard>
    <div class="feedback-footer"><a :href="FEEDBACK_ISSUES_URL" target="_blank" rel="noopener noreferrer">{{ t('options.feedback.github') }}<GitHubIcon /></a></div>
  </section>
</template>

<style scoped>
.feedback-page { width: 100%; min-width: 0; }
.feedback-card :deep(.n-card__content) { padding: 24px; }
.feedback-form { width: 100%; min-width: 0; }
.feedback-count { display: flex; justify-content: flex-end; margin-top: 8px; font-size: 12px; font-variant-numeric: tabular-nums; }
.feedback-upload { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-top: 20px; }
.feedback-upload svg, .feedback-image svg { width: 18px; height: 18px; }
.feedback-image-limit { font-size: 12px; }
.feedback-file { display: none; }
.feedback-image { display: flex; gap: 12px; align-items: center; margin-top: 16px; }
.feedback-image img { width: 96px; height: 72px; object-fit: cover; border-radius: 8px; border: 1px solid var(--layout-border); }
.feedback-email { display: grid; gap: 8px; margin-top: 24px; }
.feedback-actions { display: flex; justify-content: flex-end; margin-top: 24px; }
.feedback-error { margin: 10px 0 0; color: #d03050; font-size: 13px; }
.feedback-footer { display: flex; justify-content: center; margin-top: 20px; }
.feedback-footer a { display: inline-flex; align-items: center; gap: 8px; color: #4361ee; font-size: 13px; text-decoration: none; }
.feedback-footer a:hover { text-decoration: underline; }
.feedback-footer svg { width: 16px; height: 16px; }
:global(html.dark) .feedback-error { color: #ff9eae; }
:global(html.dark) .feedback-footer a { color: #a6b4ff; }
@media (max-width: 600px) { .feedback-card :deep(.n-card__content) { padding: 16px; } .feedback-upload { gap: 8px; } }
</style>
