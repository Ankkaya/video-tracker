export const FEEDBACK_TEXT_LIMIT = 500;
export const FEEDBACK_IMAGE_LIMIT = 5 * 1024 * 1024;
export const FEEDBACK_CONSENT_VERSION = 'feedback-v1';
export const FEEDBACK_CONSENT_KEY = 'video_tracker_feedback_consent';
export const FEEDBACK_PRIVACY_URL = 'https://github.com/Ankkaya/video-tracker/blob/master/PRIVACY_POLICY.md';
export const FEEDBACK_ISSUES_URL = 'https://github.com/Ankkaya/video-tracker/issues';

export function feedbackCharacterCount(value: string): number {
  return Array.from(value).length;
}

export function feedbackEmailIsValid(value: string): boolean {
  return !value.trim() || (value.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()));
}

export type FeedbackErrorCode = 'emptyText' | 'textLimit' | 'emailInvalid' | 'imageSize' | 'imageType' | 'imageCount' | 'unavailable' | 'rateLimited' | 'inProgress' | 'conflict' | 'failed';
export class FeedbackError extends Error {
  constructor(public readonly code: FeedbackErrorCode) { super(code); }
}

export async function validateFeedbackImage(file: File): Promise<void> {
  if (file.size > FEEDBACK_IMAGE_LIMIT) throw new FeedbackError('imageSize');
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (!((file.type === 'image/png' && png) || (file.type === 'image/jpeg' && jpeg) || (file.type === 'image/webp' && webp))) {
    throw new FeedbackError('imageType');
  }
}

export interface FeedbackPayload { requestId: string; content: string; email: string; image: File | null }
export interface FeedbackReceipt { id: string; duplicate: boolean }

export async function sendFeedback(payload: FeedbackPayload, options: {
  url?: string; key?: string; fetcher?: typeof fetch; timeoutMs?: number;
} = {}): Promise<FeedbackReceipt> {
  if (!payload.content.trim()) throw new FeedbackError('emptyText');
  if (feedbackCharacterCount(payload.content) > FEEDBACK_TEXT_LIMIT) throw new FeedbackError('textLimit');
  if (!feedbackEmailIsValid(payload.email)) throw new FeedbackError('emailInvalid');
  if (payload.image) await validateFeedbackImage(payload.image);
  const baseUrl = options.url ?? import.meta.env.VITE_SUPABASE_URL;
  const key = options.key ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!baseUrl || !key) throw new FeedbackError('unavailable');
  const form = new FormData();
  form.set('request_id', payload.requestId);
  form.set('content', payload.content);
  form.set('email', payload.email.trim());
  form.set('consent_version', FEEDBACK_CONSENT_VERSION);
  if (payload.image) form.set('image', payload.image);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 25000);
  try {
    const response = await (options.fetcher ?? fetch)(`${baseUrl.replace(/\/$/, '')}/functions/v1/submit-feedback`, {
      method: 'POST', headers: { apikey: key }, body: form, signal: controller.signal,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const allowed: FeedbackErrorCode[] = ['emptyText', 'textLimit', 'emailInvalid', 'imageSize', 'imageType', 'imageCount', 'rateLimited', 'inProgress', 'conflict'];
      throw new FeedbackError(allowed.includes(result?.code) ? result.code : 'failed');
    }
    if (!result || typeof result.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(result.id)) throw new FeedbackError('failed');
    return { id: result.id, duplicate: Boolean(result.duplicate) };
  } catch (error) {
    if (error instanceof FeedbackError) throw error;
    throw new FeedbackError('failed');
  } finally { clearTimeout(timer); }
}
