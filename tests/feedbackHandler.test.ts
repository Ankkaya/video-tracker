// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFeedbackHandler, type FeedbackStore } from '../supabase/functions/_shared/feedback-handler';

const token = crypto.randomUUID();
let store: FeedbackStore;
let handle: ReturnType<typeof createFeedbackHandler>;
function request(options: { content?: string; email?: string; images?: File[]; consent?: string; key?: string; id?: string } = {}) {
  const form = new FormData();
  form.set('request_id', options.id ?? crypto.randomUUID());
  form.set('content', options.content ?? '测试反馈');
  form.set('email', options.email ?? '');
  form.set('consent_version', options.consent ?? 'feedback-v1');
  options.images?.forEach(image => form.append('image', image));
  return new Request('https://example.com/submit-feedback', { method: 'POST', headers: { apikey: options.key ?? 'public-key', 'x-forwarded-for': '192.0.2.1' }, body: form });
}
const png = () => new File([Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0])], 'image.png', { type: 'image/png' });
beforeEach(() => {
  store = { claim: vi.fn().mockResolvedValue({ result: 'claimed', lease_token: token }), upload: vi.fn().mockResolvedValue(undefined), complete: vi.fn().mockResolvedValue(true), fail: vi.fn().mockResolvedValue(true), remove: vi.fn().mockResolvedValue(undefined) };
  handle = createFeedbackHandler(store, { apiKey: 'public-key', ipSalt: 'test-only-salt' });
});

describe('feedback backend boundary', () => {
  it('handles preflight and rejects unauthenticated requests without touching storage', async () => {
    expect((await handle(new Request('https://example.com', { method: 'OPTIONS' }))).status).toBe(204);
    expect((await handle(request({ key: 'wrong' }))).status).toBe(401);
    expect(store.claim).not.toHaveBeenCalled();
  });
  it.each([
    [{ content: ' ' }, 'emptyText'], [{ content: '字'.repeat(501) }, 'textLimit'],
    [{ email: 'invalid' }, 'emailInvalid'], [{ consent: 'old-version' }, 'consentRequired'],
  ])('validates %j before a database write', async (options, code) => {
    expect(await (await handle(request(options))).json()).toEqual({ code });
    expect(store.claim).not.toHaveBeenCalled();
  });
  it('accepts 500 Unicode characters, an omitted email, and returns only a receipt', async () => {
    const id = crypto.randomUUID();
    const response = await handle(request({ id, content: '🎬'.repeat(500) }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id, duplicate: false });
    expect(store.claim).toHaveBeenCalledWith(expect.objectContaining({ id, email: null, ipHash: expect.stringMatching(/^[a-f0-9]{64}$/) }));
  });
  it('enforces image count, size, and signature', async () => {
    expect(await (await handle(request({ images: [png(), png()] }))).json()).toEqual({ code: 'imageCount' });
    expect(await (await handle(request({ images: [new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'huge.png', { type: 'image/png' })] }))).json()).toEqual({ code: 'imageSize' });
    expect(await (await handle(request({ images: [new File(['html'], 'fake.png', { type: 'image/png' })] }))).json()).toEqual({ code: 'imageType' });
    expect(store.claim).not.toHaveBeenCalled();
  });
  it('uploads to a deterministic private path and finalizes before success', async () => {
    const id = crypto.randomUUID();
    expect((await handle(request({ id, images: [png()] }))).status).toBe(201);
    expect(store.upload).toHaveBeenCalledWith(`${id}.png`, expect.any(File));
    expect(store.complete).toHaveBeenCalledWith(id, token, `${id}.png`);
  });
  it.each([
    ['duplicate', 200], ['rate_limited', 429], ['busy', 409], ['conflict', 409],
  ])('handles database result %s without another image upload', async (result, status) => {
    vi.mocked(store.claim).mockResolvedValue({ result } as Awaited<ReturnType<FeedbackStore['claim']>>);
    expect((await handle(request({ images: [png()] }))).status).toBe(status);
    expect(store.upload).not.toHaveBeenCalled();
  });
  it('releases a failed upload for retry and does not report success', async () => {
    vi.mocked(store.upload).mockRejectedValue(new Error('upload failed'));
    expect((await handle(request({ images: [png()] }))).status).toBe(503);
    expect(store.fail).toHaveBeenCalled();
    expect(store.complete).not.toHaveBeenCalled();
  });
  it('keeps an image after an ambiguous commit so a successful submission is not corrupted', async () => {
    vi.mocked(store.complete).mockRejectedValue(new Error('response lost'));
    expect((await handle(request({ images: [png()] }))).status).toBe(503);
    expect(store.remove).not.toHaveBeenCalled();
    expect(store.fail).not.toHaveBeenCalled();
  });
  it('limits the body even if Content-Length is missing', async () => {
    const oversized = new Request('https://example.com', { method: 'POST', headers: { apikey: 'public-key', 'content-type': 'multipart/form-data; boundary=test' }, body: new Uint8Array(6 * 1024 * 1024) });
    expect((await handle(oversized)).status).toBe(413);
    expect(store.claim).not.toHaveBeenCalled();
  });
});
