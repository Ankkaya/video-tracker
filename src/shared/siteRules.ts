import type { SiteRule } from './types';

export function normalizeDomain(value: string): string {
  const domain = value.trim().toLowerCase().replace(/\.$/, '');
  if (domain.length > 253 || domain.split('.').some(label => label.length > 63)
    || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(domain)) {
    throw new Error('Invalid domain');
  }
  return domain;
}

/** 添加站点时允许粘贴网页链接；存储层仍只接受规范化的域名。 */
export function parseSiteDomain(value: string): string {
  const input = value.trim();
  if (!/^https?:\/\//i.test(input)) return normalizeDomain(input);
  // URL 会容忍部分空白和反斜杠，这些输入通常是粘贴或拼写错误。
  if (!/^https?:\/\/[^/?#]+/i.test(input) || /\s|\\/.test(input)) throw new Error('Invalid domain');
  const url = new URL(input);
  if (url.username || url.password) throw new Error('Invalid domain');
  return normalizeDomain(url.hostname);
}

/** 排除名单包含子域名；开启规则只保留为同步时的移除标记。 */
export function isSiteAutoRecordEnabled(url: string, rules: SiteRule[]): boolean {
  let host: string;
  try { host = new URL(url).hostname.toLowerCase().replace(/\.$/, ''); } catch { return false; }
  return !rules.some(rule => !rule.autoRecord && (host === rule.domain || host.endsWith('.' + rule.domain)));
}
