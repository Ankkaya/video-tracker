import { describe, expect, it } from 'vitest';
import { findVideoElements, pickBestVideo } from '../src/content/videoProbe';

function setVideoState(video: HTMLVideoElement, state: { duration?: number; paused?: boolean; width?: number; height?: number }) {
  Object.defineProperty(video, 'duration', { value: state.duration ?? 100, configurable: true });
  Object.defineProperty(video, 'paused', { value: state.paused ?? false, configurable: true });
  Object.defineProperty(video, 'clientWidth', { value: state.width ?? 640, configurable: true });
  Object.defineProperty(video, 'clientHeight', { value: state.height ?? 360, configurable: true });
  video.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: state.width ?? 640,
    bottom: state.height ?? 360,
    width: state.width ?? 640,
    height: state.height ?? 360,
    toJSON: () => ({}),
  });
}

describe('videoProbe', () => {
  it('递归查找 open shadow DOM 中的 video', () => {
    document.body.innerHTML = '<div id="host"></div>';
    const host = document.querySelector('#host') as HTMLDivElement;
    const shadow = host.attachShadow({ mode: 'open' });
    const video = document.createElement('video');
    shadow.appendChild(video);

    expect(findVideoElements()).toContain(video);
  });

  it('优先选择正在播放的视频', () => {
    const paused = document.createElement('video');
    const playing = document.createElement('video');
    setVideoState(paused, { paused: true, width: 1280, height: 720 });
    setVideoState(playing, { paused: false, width: 320, height: 180 });

    expect(pickBestVideo([paused, playing])).toBe(playing);
  });

  it('没有有效 duration 时返回第一个 video 作为兜底', () => {
    const first = document.createElement('video');
    const second = document.createElement('video');
    setVideoState(first, { duration: 0 });
    setVideoState(second, { duration: 0 });

    expect(pickBestVideo([first, second])).toBe(first);
  });
});
