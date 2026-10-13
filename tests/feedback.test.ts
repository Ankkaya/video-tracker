// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { FeedbackError, feedbackCharacterCount, feedbackEmailIsValid, sendFeedback, validateFeedbackImage } from '../src/shared/feedback';

const pngBytes = Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0]);
const png = () => new File([pngBytes], 'image.png', { type: 'image/png' });
const draft = () => ({ requestId: crypto.randomUUID(), content: '观看记录没有保存', email: '', image: null as File | null });

describe('feedback input and transport', () => {
  it('counts Unicode characters and accepts an omitted email', () => {
    expect(feedbackCharacterCount('视频🎬')).toBe(3);
    expect(feedbackEmailIsValid('')).toBe(true);
    expect(feedbackEmailIsValid(' person@example.com ')).toBe(true);
    expect(feedbackEmailIsValid('invalid')).toBe(false);
  });
  it('rejects oversized and disguised images', async () => {
    await expect(validateFeedbackImage(png())).resolves.toBeUndefined();
    await expect(validateFeedbackImage(new File(['<svg></svg>'], 'fake.png', { type: 'image/png' }))).rejects.toMatchObject({ code: 'imageType' });
    await expect(validateFeedbackImage(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }))).rejects.toMatchObject({ code: 'imageSize' });
  });
  it('enforces 500 characters before making any request', async () => {
    const fetcher = vi.fn();
    await expect(sendFeedback({ ...draft(), content: '字'.repeat(501) }, { fetcher })).rejects.toMatchObject({ code: 'textLimit' });
    await expect(sendFeedback({ ...draft(), content: ' ' }, { fetcher })).rejects.toMatchObject({ code: 'emptyText' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('sends only explicitly entered values and consent, without login tokens', async () => {
    const payload = { ...draft(), content: '🎬'.repeat(500), image: png() };
    const fetcher = vi.fn().mockResolvedValue(Response.json({ id: payload.requestId }));
    await expect(sendFeedback(payload, { url: 'https://example.com/', key: 'public-key', fetcher })).resolves.toEqual({ id: payload.requestId, duplicate: false });
    const [url, request] = fetcher.mock.calls[0];
    expect(url).toBe('https://example.com/functions/v1/submit-feedback');
    expect(request.headers).toEqual({ apikey: 'public-key' });
    expect(request.body.get('email')).toBe('');
    expect(request.body.get('consent_version')).toBe('feedback-v1');
    expect([...request.body.keys()]).toEqual(['request_id', 'content', 'email', 'consent_version', 'image']);
  });
  it('maps server rejection and network failures without exposing server details', async () => {
    await expect(sendFeedback(draft(), { url: 'https://example.com', key: 'key', fetcher: vi.fn().mockResolvedValue(Response.json({ code: 'rateLimited' }, { status: 429 })) })).rejects.toMatchObject({ code: 'rateLimited' });
    await expect(sendFeedback(draft(), { url: 'https://example.com', key: 'key', fetcher: vi.fn().mockRejectedValue(new Error('server secret')) })).rejects.toEqual(new FeedbackError('failed'));
  });
});
