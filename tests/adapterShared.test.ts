import { afterEach, describe, expect, it } from 'vitest';
import { bilibiliAdapter } from '../src/content/adapters/bilibili';
import { genericAdapter } from '../src/content/adapters/generic';
import { youtubeAdapter } from '../src/content/adapters/youtube';
import { findPlayer } from '../src/content/adapters/shared';

function ready(video: HTMLVideoElement, paused: boolean) {
  Object.defineProperties(video, {
    duration: { configurable: true, value: 100 },
    currentTime: { configurable: true, value: 25 },
    paused: { configurable: true, value: paused },
  });
}
afterEach(() => { document.body.innerHTML = ''; document.title = ''; });

describe('shared adapter player discovery', () => {
  it('dedicated adapters select the playing video instead of the first preview', () => {
    document.title = 'Video';
    document.body.innerHTML = '<video></video><video></video>';
    const [preview, main] = document.querySelectorAll('video');
    ready(preview, true); ready(main, false);
    expect(bilibiliAdapter.getVideoElement()).toBe(main);
    expect(bilibiliAdapter.extract()?.currentTime).toBe(25);
  });
  it('preserves YouTube main-player preference', () => {
    document.body.innerHTML = '<video></video><video class="html5-main-video"></video>';
    const [preview, main] = document.querySelectorAll('video');
    ready(preview, false); ready(main, true);
    expect(youtubeAdapter.getVideoElement()).toBe(main);
  });
  it('generic extraction keeps media identity for the selected shadow player', () => {
    document.title = 'Shadow video';
    const host = document.createElement('div');
    document.body.append(host);
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<video data-video-id="main"></video>';
    const video = shadow.querySelector('video')!;
    ready(video, false);
    expect(genericAdapter.getVideoElement()).toBe(video);
    expect(genericAdapter.extract()).toMatchObject({ mediaId: 'id:main', currentTime: 25, duration: 100 });
  });
  it('finds players in same-origin frames including their open shadow roots', () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const doc = iframe.contentDocument!;
    const host = doc.createElement('div');
    doc.body.append(host);
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<video></video>';
    expect(findPlayer()).toBe(shadow.querySelector('video'));
  });
});
