const onDomain = (host: string, domain: string) => host === domain || host.endsWith('.' + domain);

/** Unknown sites retain generic detection; known platforms require a playback route. */
export function isPlaybackPage(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname;
    const path = url.pathname;
    if (onDomain(host, 'bilibili.com')) {
      return /^\/video\/(?:BV[\da-z]+|av\d+)\/?$/i.test(path)
        || /^\/bangumi\/play\/(?:ep|ss)\d+\/?$/.test(path)
        || (host === 'player.bilibili.com' && path === '/player.html'
          && /^(?:BV[\da-z]+|\d+)$/i.test(url.searchParams.get('bvid') || url.searchParams.get('aid') || ''));
    }
    if (host === 'youtu.be') return /^\/[\w-]+\/?$/.test(path);
    if (onDomain(host, 'youtube.com') || onDomain(host, 'youtube-nocookie.com')) {
      return (path === '/watch' && /^[\w-]+$/.test(url.searchParams.get('v') || ''))
        || /^\/(?:shorts|embed|live)\/[\w-]+\/?$/.test(path) && !path.startsWith('/embed/videoseries');
    }
    if (onDomain(host, 'iqiyi.com')) {
      return /^\/(?:v|w)_[\w-]+\.html$/.test(path)
        || (host === 'open.iqiyi.com' && path === '/developer/player_js/coopPlayerIndex.html'
          && /^\d+$/.test(url.searchParams.get('tvid') || ''));
    }
    if (onDomain(host, 'v.qq.com')) {
      return /^\/x\/(?:cover\/[\w-]+(?:\/[\w-]+)?|page\/[\w-]+)\.html$/.test(path)
        || (/^\/iframe\/player\.html$/.test(path) && /^[\w-]+$/.test(url.searchParams.get('vid') || ''));
    }
    return true;
  } catch {
    return false;
  }
}
