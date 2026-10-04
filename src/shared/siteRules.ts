import type { SiteRule } from './types';

export function normalizeDomain(value: string): string {
  const domain = value.trim().toLowerCase().replace(/\.$/, '');
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(domain)) {
    throw new Error('Invalid domain');
  }
  return domain;
}

/** 最具体的域名规则优先，父域名规则覆盖子域名。 */
export function isSiteAutoRecordEnabled(url: string, rules: SiteRule[]): boolean {
  let host: string;
  try { host = new URL(url).hostname.toLowerCase().replace(/\.$/, ''); } catch { return false; }
  const rule = rules.filter(r => host === r.domain || host.endsWith('.' + r.domain))
    .sort((a, b) => b.domain.length - a.domain.length)[0];
  return rule?.autoRecord ?? true;
}
