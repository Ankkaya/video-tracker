import type { WatchRecord } from './types';

function cleanTimeParams(url: URL) {
  url.searchParams.delete('t');
  url.searchParams.delete('start');
}

export function buildRecordResumeUrl(record: Pick<WatchRecord, 'url' | 'platform' | 'currentTime'>): string {
  try {
    const url = new URL(record.url);
    const seconds = Math.max(0, Math.floor(record.currentTime || 0));

    cleanTimeParams(url);

    if (seconds <= 0) return url.toString();

    if (record.platform === 'vqq') {
      url.searchParams.set('start', String(seconds));
    } else {
      url.searchParams.set('t', String(seconds));
    }

    return url.toString();
  } catch {
    return record.url;
  }
}

export function parseResumeTimeFromUrl(rawUrl = globalThis.location?.href ?? ''): number | null {
  try {
    const url = new URL(rawUrl);
    const value = url.searchParams.get('t') ?? url.searchParams.get('start');
    if (!value) return null;

    const seconds = parseTimeValue(value);
    return seconds > 0 ? seconds : null;
  } catch {
    return null;
  }
}

export function parseTimeValue(value: string): number {
  const raw = value.trim().toLowerCase();
  if (!raw) return 0;

  const direct = Number(raw);
  if (Number.isFinite(direct)) return Math.floor(direct);

  const match = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
  if (!match) return 0;

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}
