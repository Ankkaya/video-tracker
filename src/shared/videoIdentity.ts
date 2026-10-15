import type { VideoInfo, WatchRecord } from './types';

type IdentityInput = Pick<VideoInfo, 'url' | 'platform'> & Partial<Pick<VideoInfo, 'episode' | 'mediaId' | 'title' | 'duration'>>;
const ignoredParams = /^(t|start|time_continue|feature|si|spm|spm_id_from|from|source|vd_source|vt_record|utm_.*)$/i;
const onDomain = (host: string, domain: string) => host === domain || host.endsWith('.' + domain);

/** One identity rule for detection, legacy records, saving and reopening. */
export function videoIdentity(input: IdentityInput): { key: string; url: string; platform: string } {
  try {
    const url = new URL(input.url);
    let platform = input.platform;
    if (onDomain(url.hostname, 'bilibili.com')) platform = 'bilibili';
    if (onDomain(url.hostname, 'youtube.com') || url.hostname === 'youtu.be') platform = 'youtube';
    if (onDomain(url.hostname, 'iqiyi.com')) platform = 'iqiyi';
    if (url.hostname === 'v.qq.com') platform = 'vqq';
    for (const name of [...url.searchParams.keys()]) if (ignoredParams.test(name)) url.searchParams.delete(name);
    if (!url.hash.startsWith('#/')) url.hash = '';
    if (platform === 'youtube' && (onDomain(url.hostname, 'youtube.com') || url.hostname === 'youtu.be')) {
      const id = url.hostname === 'youtu.be' ? url.pathname.split('/')[1]
        : url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1];
      if (id) return { key: `youtube::${id}`, platform, url: `https://www.youtube.com/watch?v=${encodeURIComponent(id)}` };
    }
    if (platform === 'bilibili' && onDomain(url.hostname, 'bilibili.com')) {
      const bv = url.pathname.match(/\/video\/([^/]+)/)?.[1];
      const ep = url.pathname.match(/\/bangumi\/play\/(ep\d+)/)?.[1];
      if (bv) {
        const page = Math.max(1, Number(url.searchParams.get('p') || input.episode?.match(/^P(\d+)$/i)?.[1] || 1) || 1);
        return { key: `bilibili::${bv}::${page}`, platform, url: `https://www.bilibili.com/video/${bv}${page > 1 ? `?p=${page}` : ''}` };
      }
      if (ep) return { key: `bilibili::${ep}`, platform, url: `https://www.bilibili.com/bangumi/play/${ep}` };
    }
    // Preserve content IDs in paths and query parameters; strip only known navigation parameters.
    url.searchParams.sort();
    const canonical = url.toString();
    if (platform === 'vqq' && url.hostname === 'v.qq.com') {
      const path = url.pathname.match(/\/x\/(?:page\/([^/.]+)|cover\/[^/]+\/([^/.]+))\.html$/);
      const id = url.searchParams.get('vid') || path?.[1] || path?.[2];
      if (id) return { key: `vqq::${id}`, url: canonical, platform };
    }
    if (platform === 'iqiyi' && onDomain(url.hostname, 'iqiyi.com')) {
      const id = url.pathname.match(/\/(v_[^/]+)\.html$/)?.[1] || url.searchParams.get('tvid') || url.searchParams.get('vid');
      if (id) return { key: `iqiyi::${id}`, url: canonical, platform };
    }
    // Blob-only players may expose no stable source. Metadata is a conservative fallback,
    // so a different title/duration on the same page does not overwrite old history.
    const mediaId = input.mediaId || (platform === 'generic' && input.title && Number.isFinite(input.duration) && (input.duration ?? 0) > 0
      ? `metadata:${input.title}::${Math.round(input.duration!)}` : undefined);
    return { key: `${platform}::${canonical}${mediaId ? `::media:${mediaId}` : ''}`, url: canonical, platform };
  } catch {
    return { key: `${input.platform}::${input.url}`, url: input.url, platform: input.platform };
  }
}

/** Only adopt a legacy page-only record when the actual video can be corroborated. */
export function findVideoRecord(records: WatchRecord[], info: IdentityInput & { title?: string; duration?: number }): WatchRecord | undefined {
  const identity = videoIdentity(info);
  const exact = records.find(record => videoIdentity(record).key === identity.key);
  if (exact) return exact;
  if (identity.platform !== 'generic') return;
  const candidates = records.filter(record => !record.mediaId && videoIdentity(record).url === identity.url && videoIdentity(record).platform === identity.platform);
  if (candidates.length !== 1) return;
  const record = candidates[0];
  if (record.duration === 0 || (record.title === info.title && Math.abs(record.duration - (info.duration ?? 0)) <= 1)) return record;
}

export function videoMediaId(video: HTMLVideoElement): string | undefined {
  const explicit = video.getAttribute('data-video-id');
  if (explicit) return `id:${explicit}`;
  return mediaSourceId(video.currentSrc || video.getAttribute('src') || '', location.href);
}

export function mediaSourceId(value: string, base?: string): string | undefined {
  if (!value) return;
  try {
    const src = new URL(value, base);
    if (!/^https?:$/.test(src.protocol)) return;
    // Signed CDN URLs change between visits; keep their stable resource path.
    for (const name of [...src.searchParams.keys()]) {
      if (/^(token|sign|signature|expires|expire|auth_key|x-amz-.*)$/i.test(name)) src.searchParams.delete(name);
    }
    src.searchParams.sort();
    src.hash = '';
    return src.toString();
  } catch { return; }
}

export function recordKeyAliases(record: Pick<WatchRecord, 'platform' | 'url'> & Partial<WatchRecord>): string[] {
  return [...new Set([videoIdentity(record).key, `${record.platform}::${record.url}`])];
}
