import { computed, onUnmounted, ref, watch, type Ref } from 'vue';
import { FEEDBACK_TEXT_LIMIT, FeedbackError, feedbackCharacterCount, feedbackEmailIsValid, sendFeedback, validateFeedbackImage, type FeedbackErrorCode } from '../../shared/feedback';

export function useFeedback(accountEmail: Ref<string>) {
  const content = ref('');
  const email = ref('');
  const image = ref<File | null>(null);
  const previewUrl = ref('');
  const imageError = ref<FeedbackErrorCode | ''>('');
  const error = ref<FeedbackErrorCode | ''>('');
  const busy = ref(false);
  const selectingImage = ref(false);
  let emailEdited = false;
  let requestId = '';
  let selectionVersion = 0;
  watch(accountEmail, value => { if (!emailEdited) email.value = value; }, { immediate: true });
  watch([content, email, image], () => { requestId = ''; error.value = ''; }, { flush: 'sync' });
  const count = computed(() => feedbackCharacterCount(content.value));
  const canSubmit = computed(() => Boolean(content.value.trim()) && count.value <= FEEDBACK_TEXT_LIMIT && !busy.value && !selectingImage.value);

  function editEmail(value: string) { emailEdited = true; email.value = value; }
  function releasePreview() { if (previewUrl.value) URL.revokeObjectURL(previewUrl.value); previewUrl.value = ''; }
  function removeImage() { selectionVersion++; selectingImage.value = false; releasePreview(); image.value = null; imageError.value = ''; }
  async function selectImage(file: File) {
    const version = ++selectionVersion;
    selectingImage.value = true;
    try {
      await validateFeedbackImage(file);
      if (version !== selectionVersion) return;
      releasePreview(); image.value = file; previewUrl.value = URL.createObjectURL(file); imageError.value = '';
    } catch (cause) {
      if (version === selectionVersion) imageError.value = cause instanceof FeedbackError ? cause.code : 'imageType';
    } finally { if (version === selectionVersion) selectingImage.value = false; }
  }
  function validate() {
    error.value = !content.value.trim() ? 'emptyText' : count.value > FEEDBACK_TEXT_LIMIT ? 'textLimit' : !feedbackEmailIsValid(email.value) ? 'emailInvalid' : '';
    return !error.value && !selectingImage.value;
  }
  async function submit() {
    if (busy.value || !validate()) return false;
    // A failed/ambiguous response keeps this id. Editing a draft creates a new submission.
    requestId ||= crypto.randomUUID();
    const payload = { requestId, content: content.value, email: email.value, image: image.value };
    busy.value = true; error.value = '';
    try {
      await sendFeedback(payload);
      content.value = ''; removeImage(); requestId = '';
      return true;
    } catch (cause) { error.value = cause instanceof FeedbackError ? cause.code : 'failed'; return false; }
    finally { busy.value = false; }
  }
  onUnmounted(() => { selectionVersion++; releasePreview(); });
  return { content, email, image, previewUrl, imageError, error, busy, selectingImage, count, canSubmit, editEmail, selectImage, removeImage, validate, submit };
}
