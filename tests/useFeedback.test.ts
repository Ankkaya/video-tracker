import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, ref } from 'vue';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { useFeedback } from '../src/options/composables/useFeedback';
import { FeedbackError, sendFeedback } from '../src/shared/feedback';
vi.mock('../src/shared/feedback', async importOriginal => ({ ...await importOriginal<typeof import('../src/shared/feedback')>(), sendFeedback: vi.fn() }));
let wrapper: VueWrapper;
let state: ReturnType<typeof useFeedback>;
const account = ref('');
beforeEach(() => {
  vi.clearAllMocks(); account.value = '';
  wrapper = mount(defineComponent({ setup() { state = useFeedback(account); return () => null; } }));
});
afterEach(() => wrapper.unmount());
describe('feedback draft lifecycle', () => {
  it('prefills a delayed login email but respects a manual edit or clear', async () => {
    account.value = 'login@example.com'; await flushPromises();
    expect(state.email.value).toBe('login@example.com');
    state.editEmail(''); account.value = 'other@example.com'; await flushPromises();
    expect(state.email.value).toBe('');
  });
  it('preserves the draft and request id after a failed or timed-out submit', async () => {
    state.content.value = '失败重试测试'; state.editEmail('contact@example.com');
    vi.mocked(sendFeedback).mockRejectedValueOnce(new FeedbackError('failed')).mockResolvedValueOnce({ id: 'receipt', duplicate: true });
    expect(await state.submit()).toBe(false);
    expect(state.content.value).toBe('失败重试测试'); expect(state.email.value).toBe('contact@example.com');
    expect(await state.submit()).toBe(true);
    expect(vi.mocked(sendFeedback).mock.calls[0][0].requestId).toBe(vi.mocked(sendFeedback).mock.calls[1][0].requestId);
    expect(state.content.value).toBe('');
  });
  it('gives an edited draft a new request id and rejects double clicks', async () => {
    state.content.value = '第一次'; vi.mocked(sendFeedback).mockRejectedValue(new FeedbackError('failed'));
    await state.submit(); const id = vi.mocked(sendFeedback).mock.calls[0][0].requestId;
    state.content.value = '第二次';
    let finish!: (value: { id: string; duplicate: boolean }) => void;
    vi.mocked(sendFeedback).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const pending = state.submit(); await state.submit();
    expect(sendFeedback).toHaveBeenCalledTimes(2); expect(vi.mocked(sendFeedback).mock.calls[1][0].requestId).not.toBe(id);
    finish({ id: 'receipt', duplicate: false }); await pending;
  });
});
