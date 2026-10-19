import type { VideoInfo } from '../../shared/types';
import type { VideoAdapter } from './types';
import { findVideoElements, pickBestVideo } from '../videoProbe';
import { isPlaybackPage } from '../../shared/playbackPage';

type Metadata = Omit<VideoInfo, 'currentTime' | 'duration' | 'platform' | 'platformName'> & { platformName?: string };
interface AdapterRules {
  platform: string;
  platformName: string;
  detect(): boolean;
  metadata(video: HTMLVideoElement): Metadata | null;
  preferredVideoSelector?: string;
  resumeParam?: 't' | 'start';
}

/** Shared discovery retains open shadow DOM and same-origin frame support. */
export function findPlayer(preferredSelector?: string): HTMLVideoElement | null {
  const videos = findVideoElements();
  const preferred = preferredSelector ? videos.filter(video => video.matches(preferredSelector)) : [];
  const video = pickBestVideo(preferred.length ? preferred : videos);
  if (video) return video;
  for (const iframe of document.querySelectorAll('iframe')) {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        const candidate = pickBestVideo(findVideoElements(doc));
        if (candidate) return candidate;
      }
    } catch { /* Cross-origin frames are handled by their own content scripts. */ }
  }
  return null;
}

export function createVideoAdapter(rules: AdapterRules): VideoAdapter {
  return {
    platform: rules.platform,
    platformName: rules.platformName,
    detect: rules.detect,
    getVideoElement() { return findPlayer(rules.preferredVideoSelector); },
    extract() {
      if (!isPlaybackPage(location.href)) return null;
      const video = this.getVideoElement();
      if (!video) return null;
      const metadata = rules.metadata(video);
      if (!metadata) return null;
      if (!isPlaybackPage(metadata.url)) return null;
      return {
        ...metadata,
        platform: rules.platform,
        platformName: metadata.platformName ?? rules.platformName,
        currentTime: video.currentTime,
        duration: video.duration || 0,
      };
    },
    buildResumeUrl(url, currentTime) {
      try {
        const result = new URL(url, location.origin);
        result.searchParams.delete('t');
        result.searchParams.delete('start');
        result.searchParams.set(rules.resumeParam ?? 't', String(Math.floor(currentTime)));
        return result.toString();
      } catch { return url; }
    },
  };
}
