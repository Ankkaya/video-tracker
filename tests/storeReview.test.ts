import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { claimStoreReview, countReviewSave, initializeStoreReview, snoozeStoreReview } from '../src/shared/storeReview';

const DAY = 24 * 60 * 60 * 1000;
const installedAt = Date.UTC(2026, 0, 1);

describe('store review invitation', () => {
  beforeEach(async () => {
    const storage: Record<string, unknown> = {};
    vi.stubGlobal('chrome', { storage: { local: {
      get: async (key: string) => ({ [key]: storage[key] }),
      set: async (values: Record<string, unknown>) => { Object.assign(storage, values); },
    } } });
    vi.useFakeTimers();
    vi.setSystemTime(installedAt);
    await initializeStoreReview();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('requires both seven days and five saves, and does not repeat an invitation that was closed', async () => {
    for (let i = 0; i < 4; i++) await countReviewSave();
    vi.setSystemTime(installedAt + 7 * DAY);
    expect(await claimStoreReview()).toBeUndefined();
    vi.setSystemTime(installedAt + 7 * DAY - 1);
    await countReviewSave();
    expect(await claimStoreReview()).toBeUndefined();
    vi.setSystemTime(installedAt + 7 * DAY);
    await initializeStoreReview(); // An extension update preserves prior progress.
    expect(await claimStoreReview()).toBe('first');
    vi.setSystemTime(installedAt + 40 * DAY);
    expect(await claimStoreReview()).toBeUndefined();
  });

  it('offers exactly one follow-up starting 30 days after snoozing', async () => {
    for (let i = 0; i < 5; i++) await countReviewSave();
    vi.setSystemTime(installedAt + 8 * DAY);
    expect(await claimStoreReview()).toBe('first');
    await snoozeStoreReview();
    vi.setSystemTime(installedAt + 38 * DAY - 1);
    expect(await claimStoreReview()).toBeUndefined();
    vi.setSystemTime(installedAt + 38 * DAY);
    expect(await claimStoreReview()).toBe('reminder');
    await snoozeStoreReview();
    vi.setSystemTime(installedAt + 90 * DAY);
    expect(await claimStoreReview()).toBeUndefined();
  });
});
