const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_BODY = MAX_IMAGE + 64 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store' };
type Claim = { result: 'claimed' | 'duplicate' | 'busy' | 'rate_limited' | 'conflict'; lease_token?: string };
export interface FeedbackStore {
  claim(data: { id: string; hash: string; content: string; email: string | null; ipHash: string }): Promise<Claim>;
  upload(path: string, image: File): Promise<void>;
  complete(id: string, token: string, path: string | null): Promise<boolean>;
  fail(id: string, token: string): Promise<boolean>;
  remove(path: string): Promise<void>;
}
function reply(status: number, data: unknown) { return Response.json(data, { status, headers: CORS }); }
async function hash(value: string | ArrayBuffer) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function limitedForm(request: Request) {
  if (!request.body || Number(request.headers.get('content-length') ?? 0) > MAX_BODY) throw new Error('imageSize');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BODY) { await reader.cancel(); throw new Error('imageSize'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new Response(bytes, { headers: { 'content-type': request.headers.get('content-type') ?? '' } }).formData();
}
function imageExtension(bytes: Uint8Array, type: string) {
  if (type === 'image/png' && [137,80,78,71,13,10,26,10].every((b,i) => bytes[i] === b)) return 'png';
  if (type === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg';
  if (type === 'image/webp' && String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP') return 'webp';
  return null;
}
export function createFeedbackHandler(store: FeedbackStore, config: { apiKey: string; ipSalt: string }) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'POST') return reply(405, { code: 'methodNotAllowed' });
    // Custom API-key gate permits signed-out users. This is a publishable key;
    // it is NOT proof of a trusted installation. Database rate limits are mandatory.
    if (!config.apiKey || request.headers.get('apikey') !== config.apiKey) return reply(401, { code: 'unauthorized' });
    if (!request.headers.get('content-type')?.startsWith('multipart/form-data;')) return reply(400, { code: 'invalidRequest' });
    let form: FormData;
    try { form = await limitedForm(request); }
    catch (error) { return reply(error instanceof Error && error.message === 'imageSize' ? 413 : 400, { code: error instanceof Error && error.message === 'imageSize' ? 'imageSize' : 'invalidRequest' }); }
    for (const key of ['request_id', 'content', 'email', 'consent_version']) if (form.getAll(key).length > 1) return reply(400, { code: 'invalidRequest' });
    if (form.get('consent_version') !== 'feedback-v1') return reply(400, { code: 'consentRequired' });
    const id = form.get('request_id'), content = form.get('content'), rawEmail = form.get('email') ?? '';
    if (typeof id !== 'string' || !UUID.test(id) || typeof content !== 'string' || typeof rawEmail !== 'string') return reply(400, { code: 'invalidRequest' });
    if (!content.trim()) return reply(400, { code: 'emptyText' });
    if (Array.from(content).length > 500) return reply(400, { code: 'textLimit' });
    const email = rawEmail.trim() || null;
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return reply(400, { code: 'emailInvalid' });
    const images = form.getAll('image');
    if (images.length > 1) return reply(400, { code: 'imageCount' });
    const image = images[0];
    if (image && !(image instanceof File)) return reply(400, { code: 'imageType' });
    if (image instanceof File && image.size > MAX_IMAGE) return reply(413, { code: 'imageSize' });
    let extension: string | null = null;
    let imageHash = '';
    if (image instanceof File) {
      const bytes = await image.arrayBuffer();
      extension = imageExtension(new Uint8Array(bytes).slice(0,12), image.type);
      if (!extension) return reply(400, { code: 'imageType' });
      imageHash = await hash(bytes);
    }
    const ip = (request.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
    const requestHash = await hash(JSON.stringify([content, email, imageHash, extension]));
    const ipHash = await hash(`${config.ipSalt}:${ip}`);
    let token: string;
    try {
      const claimed = await store.claim({ id, hash: requestHash, content, email, ipHash });
      if (claimed.result === 'duplicate') return reply(200, { id, duplicate: true });
      if (claimed.result === 'rate_limited') return reply(429, { code: 'rateLimited' });
      if (claimed.result === 'busy') return reply(409, { code: 'inProgress' });
      if (claimed.result === 'conflict') return reply(409, { code: 'conflict' });
      if (!claimed.lease_token) throw new Error('Missing lease');
      token = claimed.lease_token;
    } catch { return reply(503, { code: 'failed' }); }
    const path = extension ? `${id}.${extension}` : null;
    try { if (path && image instanceof File) await store.upload(path, image); }
    catch {
      await store.fail(id, token).catch(() => false);
      return reply(503, { code: 'failed' });
    }
    try {
      if (!await store.complete(id, token, path)) return reply(409, { code: 'inProgress' });
      return reply(201, { id, duplicate: false });
    } catch {
      // Do not delete an image on an ambiguous database response: commit might
      // have succeeded. A retry reuses the same id/path and checks the row first.
      return reply(503, { code: 'failed' });
    }
  };
}
