import { HEARTBEAT_INTERVAL, PROGRESS_SAVE_INTERVAL } from './constants';
import { StorageManager } from './storage';
import { isSiteAutoRecordEnabled } from './siteRules';
import { findVideoRecord, videoIdentity } from './videoIdentity';
import { isRecordCompleted, nearVideoEnd } from './watchStatus';
import { isPlaybackPage } from './playbackPage';
import type { Settings, VideoInfo, WatchRecord } from './types';

interface Session {
  info: VideoInfo;
  key: string;
  recordId?: string;
  accumulated: number;
  lastTick: number;
  playing: boolean;
  lastSavedAt: number;
}

/** Call through the background mutation queue so reads and writes cannot race. */
export class ProgressTracker {
  private sessions = new Map<string, Session>();
  constructor(private onSaved: () => void) {}

  async match(info: VideoInfo) {
    if (!isPlaybackPage(info.url)) return { allowNew: false, key: videoIdentity(info).key };
    const [records, settings] = await Promise.all([StorageManager.getRecords(), StorageManager.getSettings()]);
    return { record: findVideoRecord(records, info), allowNew: this.canCreate(settings, info.url), key: videoIdentity(info).key };
  }

  private canCreate(settings: Settings, url: string) {
    return settings.autoRecord && isSiteAutoRecordEnabled(url, settings.siteRules);
  }

  async report(info: VideoInfo, source: string) {
    if (!isPlaybackPage(info.url)) { await this.flush(source); return; }
    if (!Number.isFinite(info.duration) || info.duration <= 0 || !Number.isFinite(info.currentTime) || info.currentTime < 0) return;
    const identity = videoIdentity(info);
    info = { ...info, url: identity.url, platform: identity.platform };
    const now = Date.now();
    let session = this.sessions.get(source);
    if (session && session.key !== identity.key) {
      await this.flush(source);
      session = undefined;
    }
    const [records, settings] = await Promise.all([StorageManager.getRecords(), StorageManager.getSettings()]);
    const existing = findVideoRecord(records, info);
    // A deleted active record stays deleted until explicitly saved or revisited.
    if (session?.recordId && !existing) return;
    const allowNew = this.canCreate(settings, info.url);
    if (!existing && !allowNew) { this.sessions.delete(source); return; }
    if (!session && !existing && info.isPlaying === false) return;
    // Only the active playing source may update a shared video, not a stale paused tab/frame.
    for (const [otherSource, other] of this.sessions) {
      if (otherSource !== source && other.key === identity.key && other.playing && now - other.lastTick < HEARTBEAT_INTERVAL * 2) return;
    }
    if (!session) {
      session = { info, key: identity.key, recordId: existing?.id, accumulated: 0, lastTick: now,
        playing: info.isPlaying !== false, lastSavedAt: now };
      this.sessions.set(source, session);
    } else {
      if (session.playing && info.currentTime > session.info.currentTime && info.event !== 'seeked') {
        session.accumulated += Math.max(0, Math.min((now - session.lastTick) / 1000, HEARTBEAT_INTERVAL / 1000));
      }
      session.lastTick = now;
      session.playing = info.isPlaying !== false;
      session.info = info;
      session.recordId = existing?.id;
    }
    const force = info.event === 'pause' || info.event === 'seeked' || info.event === 'ended'
      || info.event === 'switch' || info.event === 'unload'
      || (info.event === 'play' && existing && isRecordCompleted(existing) && !nearVideoEnd(info) && info.currentTime < existing.currentTime);
    if ((!existing && allowNew && session.accumulated >= settings.threshold)
      || (existing && (force || now - session.lastSavedAt >= PROGRESS_SAVE_INTERVAL))) {
      return this.persist(session, existing);
    }
  }

  async flush(source: string, snapshot?: VideoInfo) {
    const session = this.sessions.get(source);
    if (!session) {
      if (snapshot) await this.report({ ...snapshot, isPlaying: false, event: 'unload' }, source);
      this.sessions.delete(source);
      return;
    }
    for (const [otherSource, other] of this.sessions) {
      if (otherSource !== source && other.key === session.key && other.playing && Date.now() - other.lastTick < HEARTBEAT_INTERVAL * 2) {
        this.sessions.delete(source);
        return;
      }
    }
    if (snapshot && Number.isFinite(snapshot.currentTime) && Number.isFinite(snapshot.duration) && snapshot.duration > 0
      && (videoIdentity(snapshot).key === session.key || (snapshot.mediaId && snapshot.mediaId === session.info.mediaId))) {
      // Keep the cached page identity: an iframe referrer or sender tab may already be stale.
      if (session.playing && snapshot.currentTime > session.info.currentTime) {
        session.accumulated += Math.max(0, Math.min((Date.now() - session.lastTick) / 1000, HEARTBEAT_INTERVAL / 1000));
      }
      session.info = { ...session.info, currentTime: snapshot.currentTime, duration: snapshot.duration, event: snapshot.event, isPlaying: false };
    }
    const [records, settings] = await Promise.all([StorageManager.getRecords(), StorageManager.getSettings()]);
    const existing = findVideoRecord(records, session.info);
    if (existing || (!session.recordId && this.canCreate(settings, session.info.url) && session.accumulated >= settings.threshold)) {
      await this.persist(session, existing);
    }
    this.sessions.delete(source);
  }

  async flushTab(tabId: number) {
    for (const source of [...this.sessions.keys()]) if (source.startsWith(`${tabId}:`)) await this.flush(source);
  }

  settingsChanged(settings: Settings) {
    for (const [source, session] of this.sessions) {
      if (!session.recordId && !this.canCreate(settings, session.info.url)) this.sessions.delete(source);
    }
  }

  async saveManual(info: VideoInfo) {
    if (!isPlaybackPage(info.url)) throw new Error('NO_VIDEO');
    const identity = videoIdentity(info);
    info = { ...info, url: identity.url, platform: identity.platform };
    const existing = findVideoRecord(await StorageManager.getRecords(), info);
    const session: Session = { info, key: identity.key, recordId: existing?.id, accumulated: 0,
      lastTick: Date.now(), playing: info.isPlaying !== false, lastSavedAt: 0 };
    const result = await this.persist(session, existing);
    for (const active of this.sessions.values()) {
      if (active.key === identity.key) { active.recordId = session.recordId; active.lastSavedAt = session.lastSavedAt; }
    }
    return result;
  }

  async setCompleted(id: string, completed: boolean) {
    if (typeof completed !== 'boolean') throw new Error('Invalid completion state');
    const record = (await StorageManager.getRecords()).find(item => item.id === id);
    if (!record) throw new Error('Record not found');
    const updated: WatchRecord = { ...record, completed, completionSource: 'manual', lastWatchedAt: Date.now() };
    await StorageManager.saveRecord(updated);
    this.onSaved();
    return updated;
  }

  private async persist(session: Session, existing?: WatchRecord) {
    const info = session.info;
    let completed = existing?.completionSource === 'manual' ? !!existing.completed : nearVideoEnd(info);
    let completionSource = existing?.completionSource ?? 'auto';
    if (info.event === 'ended') { completed = true; completionSource = 'auto'; }
    else if (existing && isRecordCompleted(existing) && info.event === 'play' && !nearVideoEnd(info)
      && info.currentTime < existing.currentTime) { completed = false; completionSource = 'auto'; }
    const identity = videoIdentity(info);
    const record: WatchRecord = {
      ...existing, ...info, videoKey: identity.key, url: identity.url, platform: identity.platform,
      platformName: identity.platform === 'generic' ? new URL(identity.url).hostname : info.platformName,
      id: existing?.id ?? `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      currentTime: Math.min(info.currentTime, info.duration || info.currentTime),
      progress: info.duration > 0 ? Math.min(1, info.currentTime / info.duration) : 0,
      completed, completionSource,
      createdAt: existing?.createdAt ?? Date.now(), lastWatchedAt: Date.now(),
    };
    // Report-only flags are not part of stored history.
    delete (record as Partial<VideoInfo>).event;
    delete (record as Partial<VideoInfo>).isPlaying;
    const changed = !existing || ['url', 'videoKey', 'mediaId', 'title', 'episode', 'duration', 'currentTime', 'completed', 'completionSource']
      .some(key => (record as any)[key] !== (existing as any)[key]);
    if (changed) {
      await StorageManager.saveRecord(record);
      this.onSaved();
    }
    session.recordId = record.id;
    session.lastSavedAt = Date.now();
    return { isNew: !existing, record };
  }
}
