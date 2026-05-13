/** 在普通 DOM 和 open shadow DOM 中递归查找 video 元素 */
export function findVideoElements(root: ParentNode = document): HTMLVideoElement[] {
  const videos = Array.from(root.querySelectorAll('video')) as HTMLVideoElement[];
  const elements = Array.from(root.querySelectorAll('*')) as HTMLElement[];

  for (const el of elements) {
    if (el.shadowRoot) {
      videos.push(...findVideoElements(el.shadowRoot));
    }
  }

  return videos;
}

/** 判断 video 是否已具备可用的播放进度信息 */
export function isUsableVideo(video: HTMLVideoElement): boolean {
  return Number.isFinite(video.duration) && video.duration > 0;
}

/**
 * 从多个 video 中挑选最像主播放器的一个：
 * 正在播放优先，其次选择页面中显示面积更大的元素。
 */
export function pickBestVideo(videos: HTMLVideoElement[]): HTMLVideoElement | null {
  const candidates = videos.filter(isUsableVideo);
  if (candidates.length === 0) return videos[0] ?? null;

  return candidates.sort((a, b) => scoreVideo(b) - scoreVideo(a))[0] ?? null;
}

function scoreVideo(video: HTMLVideoElement): number {
  const rect = video.getBoundingClientRect();
  const area = Math.max(video.clientWidth * video.clientHeight, rect.width * rect.height, 0);
  const playingBonus = video.paused ? 0 : 1_000_000;
  const visibleBonus = area > 0 ? 10_000 : 0;
  return playingBonus + visibleBonus + area;
}
