import { describe, expect, it } from 'vitest';
import {
  createSyncPlaintext,
  mergeEncryptedCustomSites,
  mergeEncryptedDeletedRecords,
  mergeEncryptedRecords,
  pruneSupersededDeletedRecords,
} from '../src/shared/encryptedSync';
import type { WatchRecord } from '../src/shared/types';

function record(overrides: Partial<WatchRecord>): WatchRecord {
  return {
    id: '1',
    url: 'https://example.com/video',
    title: 'Old title',
    episode: '正片',
    platform: 'youtube',
    platformName: 'YouTube',
    currentTime: 10,
    duration: 100,
    progress: 0.1,
    lastWatchedAt: 1000,
    createdAt: 1000,
    ...overrides,
  };
}

describe('encrypted sync data helpers', () => {
  it('creates the sync plaintext envelope', () => {
    const records = [record({ id: 'a' })];
    const customSites = [{ domain: 'example.com', enabled: true, addedAt: 1 }];
    const deletedRecords = [{ key: 'youtube::https://example.com/video', deletedAt: 2 }];
    const plaintext = createSyncPlaintext(records, customSites, deletedRecords);

    expect(plaintext.version).toBe(1);
    expect(plaintext.records).toBe(records);
    expect(plaintext.deletedRecords).toBe(deletedRecords);
    expect(plaintext.customSites).toBe(customSites);
    expect(plaintext.exportedAt).toBeGreaterThan(0);
  });

  it('merges records by local platform and URL key', () => {
    const local = record({ id: 'local', title: 'Local', currentTime: 20, progress: 0.2, lastWatchedAt: 2000 });
    const cloud = record({ id: 'cloud', title: 'Cloud', currentTime: 50, progress: 0.5, lastWatchedAt: 1500 });
    const merged = mergeEncryptedRecords([local], [cloud]);

    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe('Local');
    expect(merged[0].currentTime).toBe(20);
    expect(merged[0].createdAt).toBe(1000);
  });

  it('does not restore a cloud record deleted after its last update', () => {
    const cloud = record({ id: 'cloud', lastWatchedAt: 1500, createdAt: 1000 });
    const merged = mergeEncryptedRecords([], [cloud], [
      { key: 'youtube::https://example.com/video', deletedAt: 2000 },
    ]);

    expect(merged).toEqual([]);
  });

  it('keeps a record updated after an older deletion tombstone', () => {
    const local = record({ id: 'local', lastWatchedAt: 2500, createdAt: 1000 });
    const merged = mergeEncryptedRecords([local], [], [
      { key: 'youtube::https://example.com/video', deletedAt: 2000 },
    ]);

    expect(merged).toEqual([local]);
    expect(pruneSupersededDeletedRecords(merged, [
      { key: 'youtube::https://example.com/video', deletedAt: 2000 },
    ])).toEqual([]);
  });

  it('keeps the newest deletion tombstone for each record key', () => {
    const merged = mergeEncryptedDeletedRecords(
      [{ key: 'youtube::a', deletedAt: 1000 }],
      [{ key: 'youtube::a', deletedAt: 2000 }, { key: 'youtube::b', deletedAt: 1500 }],
    );

    expect(merged).toEqual([
      { key: 'youtube::a', deletedAt: 2000 },
      { key: 'youtube::b', deletedAt: 1500 },
    ]);
  });

  it('merges custom sites by domain', () => {
    const merged = mergeEncryptedCustomSites(
      [{ domain: 'example.com', enabled: false, addedAt: 1 }],
      [{ domain: 'example.com', enabled: true, addedAt: 2 }],
    );

    expect(merged).toEqual([{ domain: 'example.com', enabled: true, addedAt: 2 }]);
  });
});
