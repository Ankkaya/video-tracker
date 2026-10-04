import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeDomain, isSiteAutoRecordEnabled } from '../src/shared/siteRules';
import { StorageManager } from '../src/shared/storage';
import { STORAGE_KEYS } from '../src/shared/constants';
import { mergeEncryptedSiteRules } from '../src/shared/encryptedSync';

const disabled = { domain: 'example.com', autoRecord: false, updatedAt: 1 };
describe('site automatic recording rules', () => {
  it('allows unconfigured sites and matches complete domain boundaries', () => {
    expect(isSiteAutoRecordEnabled('https://other.test/watch', [disabled])).toBe(true);
    expect(isSiteAutoRecordEnabled('https://example.com/watch', [disabled])).toBe(false);
    expect(isSiteAutoRecordEnabled('https://player.example.com/watch', [disabled])).toBe(false);
    expect(isSiteAutoRecordEnabled('https://fakeexample.com/watch', [disabled])).toBe(true);
    expect(isSiteAutoRecordEnabled('invalid', [disabled])).toBe(false);
  });
  it('uses the most specific rule, including an explicit re-enable', () => {
    const rules = [disabled, { domain: 'player.example.com', autoRecord: true, updatedAt: 2 }];
    expect(isSiteAutoRecordEnabled('https://player.example.com/watch', rules)).toBe(true);
    expect(isSiteAutoRecordEnabled('https://child.player.example.com/watch', rules)).toBe(true);
    expect(isSiteAutoRecordEnabled('https://other.example.com/watch', rules)).toBe(false);
  });
  it('normalizes input and rejects URLs and wildcard domains', () => {
    expect(normalizeDomain(' Example.COM. ')).toBe('example.com');
    for (const value of ['https://example.com', '*.example.com', 'example.com/path', '-bad.com']) {
      expect(() => normalizeDomain(value)).toThrow();
    }
  });
  it('syncs the newest rule so re-enabling survives an older cloud disable', () => {
    const enabled = { ...disabled, autoRecord: true, updatedAt: 3 };
    expect(mergeEncryptedSiteRules([enabled], [disabled])).toEqual([enabled]);
    expect(mergeEncryptedSiteRules([disabled], [enabled])).toEqual([enabled]);
  });
});

describe('site rule storage', () => {
  let values: Record<string, any>;
  beforeEach(() => {
    values = {};
    vi.stubGlobal('chrome', { storage: { local: {
      get: async (key: string) => ({ [key]: values[key] }),
      set: async (next: any) => { Object.assign(values, next); },
    } } });
  });
  it('stores enable and disable changes without duplicate domains', async () => {
    await StorageManager.setSiteRule('Example.COM', false);
    const rules = await StorageManager.setSiteRule('example.com', true);
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ domain: 'example.com', autoRecord: true });
    expect(rules[0].updatedAt).toBeGreaterThan(0);
    expect(values[STORAGE_KEYS.SETTINGS].siteRules).toEqual(rules);
  });
});
