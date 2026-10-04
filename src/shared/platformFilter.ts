import type { WatchRecord } from './types';

export const builtinPlatforms = ['bilibili', 'youtube', 'iqiyi', 'vqq'];

function hostname(url: string): string {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
}

export function matchesPlatform(record: Pick<WatchRecord, 'url' | 'platform'>, filter: string): boolean {
  if (filter === 'all') return true;
  if (!filter.startsWith('site:')) return record.platform === filter;
  const domain = filter.slice(5);
  const host = hostname(record.url);
  return host === domain || host.endsWith(`.${domain}`);
}

export function customPlatformOptions(records: Pick<WatchRecord, 'url' | 'platform'>[]) {
  const domains = new Set<string>();
  for (const record of records) {
    if (builtinPlatforms.includes(record.platform)) continue;
    const host = hostname(record.url);
    if (host) {
      domains.add(host);
    }
  }
  return [...domains].sort().map(domain => ({ label: domain, value: `site:${domain}` }));
}
