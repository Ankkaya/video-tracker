/** Packaged icons only: rendering a record never contacts the video website. */
export const siteBrands = [
  { id: 'bilibili', name: '哔哩哔哩', color: '#00a1d6', domains: ['bilibili.com', 'b23.tv', 'bilibili.tv'], extension: 'ico' },
  { id: 'youtube', name: 'YouTube', color: '#ff0033', domains: ['youtube.com', 'youtu.be', 'youtube-nocookie.com'] },
  { id: 'iqiyi', name: '爱奇艺', color: '#00c853', domains: ['iqiyi.com', 'iq.com'], extension: 'ico' },
  { id: 'vqq', name: '腾讯视频', color: '#00b5ef', domains: ['v.qq.com', 'wetv.vip'], extension: 'ico' },
  { id: 'youku', name: '优酷', color: '#00b5ef', domains: ['youku.com', 'youku.tv'], extension: 'ico' },
  { id: 'netflix', name: 'Netflix', color: '#e50914', domains: ['netflix.com'] },
  { id: 'twitch', name: 'Twitch', color: '#9146ff', domains: ['twitch.tv'] },
  { id: 'vimeo', name: 'Vimeo', color: '#1ab7ea', domains: ['vimeo.com'] },
  { id: 'dailymotion', name: 'Dailymotion', color: '#222222', domains: ['dailymotion.com', 'dai.ly'] },
  { id: 'niconico', name: 'niconico', color: '#555555', domains: ['nicovideo.jp', 'nico.ms'] },
  { id: 'primevideo', name: 'Prime Video', color: '#00a8e1', domains: ['primevideo.com', 'amazon.com', 'amazon.co.jp', 'amazon.co.uk', 'amazon.de'] },
  { id: 'crunchyroll', name: 'Crunchyroll', color: '#f47521', domains: ['crunchyroll.com'] },
  { id: 'tiktok', name: 'TikTok', color: '#555555', domains: ['tiktok.com', 'douyin.com'], aliases: ['douyin'] },
  { id: 'kuaishou', name: '快手', color: '#ff4906', domains: ['kuaishou.com', 'kwai.com'], aliases: ['kwai'] },
  { id: 'kick', name: 'Kick', color: '#328b11', domains: ['kick.com'] },
  { id: 'rumble', name: 'Rumble', color: '#71a832', domains: ['rumble.com'] },
  { id: 'ted', name: 'TED', color: '#e62b1e', domains: ['ted.com'] },
] as const;

export function getSiteBrand(record: { url: string; platform: string }) {
  let host = '';
  try { host = new URL(record.url).hostname.toLowerCase(); } catch { /* Older imported records may have no valid URL. */ }
  const brand = siteBrands.find(site => site.domains.some(domain => host === domain || host.endsWith(`.${domain}`)))
    ?? siteBrands.find(site => site.id === record.platform || ('aliases' in site && (site.aliases as readonly string[]).includes(record.platform)));
  if (!brand) return null;
  return { ...brand, icon: `/site-icons/${brand.id}.${'extension' in brand ? brand.extension : 'svg'}` };
}
