import { describe, expect, it } from 'vitest';
import {
  createSyncPlaintext,
  mergeEncryptedCustomSites,
  mergeEncryptedRecords,
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
    const plaintext = createSyncPlaintext(records, customSites);

    expect(plaintext.version).toBe(1);
    expect(plaintext.records).toBe(records);
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

  it('merges custom sites by domain', () => {
    const merged = mergeEncryptedCustomSites(
      [{ domain: 'example.com', enabled: false, addedAt: 1 }],
      [{ domain: 'example.com', enabled: true, addedAt: 2 }],
    );

    expect(merged).toEqual([{ domain: 'example.com', enabled: true, addedAt: 2 }]);
  });
});
