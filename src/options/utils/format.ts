/** 秒数 -> hh:mm:ss / mm:ss */
export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** 时间戳 -> 友好显示 */
export function formatDate(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return new Date(timestamp).toLocaleDateString('zh-CN');
}

/** Date -> YYYY-MM-DD */
export function formatDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** 内置平台图标映射 */
export const platformIcons: Record<string, string> = {
  bilibili: '📺',
  youtube: '▶️',
  iqiyi: '🥝',
  vqq: '🎬',
};

/** 内置站点元数据 */
export const BUILTIN_SITES = [
  { domain: 'bilibili.com', name: 'B站', icon: '📺' },
  { domain: 'youtube.com', name: 'YouTube', icon: '▶️' },
  { domain: 'iqiyi.com', name: '爱奇艺', icon: '🥝' },
  { domain: 'v.qq.com', name: '腾讯视频', icon: '🎬' },
] as const;

/** 校验域名合法性 */
export function isValidDomain(domain: string): boolean {
  const pattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
  return pattern.test(domain);
}
