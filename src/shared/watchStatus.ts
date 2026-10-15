import type { WatchRecord } from './types';

export function nearVideoEnd(record: Pick<WatchRecord, 'currentTime' | 'duration'>): boolean {
  return Number.isFinite(record.duration) && record.duration > 0 && Number.isFinite(record.currentTime)
    && record.duration - record.currentTime <= Math.min(10, record.duration * 0.02);
}

export function isRecordCompleted(record: Pick<WatchRecord, 'currentTime' | 'duration' | 'completed'>): boolean {
  return record.completed ?? nearVideoEnd(record);
}
