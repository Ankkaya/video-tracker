import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeDomain, parseSiteDomain, isSiteAutoRecordEnabled } from '../src/shared/siteRules';
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
  it('includes subdomains even when they have an older enable rule', () => {
    const rules = [disabled, { domain: 'player.example.com', autoRecord: true, updatedAt: 2 }];
    expect(isSiteAutoRecordEnabled('https://player.example.com/watch', rules)).toBe(false);
    expect(isSiteAutoRecordEnabled('https://child.player.example.com/watch', rules)).toBe(false);
    expect(isSiteAutoRecordEnabled('https://other.example.com/watch', rules)).toBe(false);
  });
  it('restores a removed domain while keeping separately excluded subdomains blocked', () => {
    const rules = [{ ...disabled, autoRecord: true }, { domain: 'player.example.com', autoRecord: false, updatedAt: 2 }];
    expect(isSiteAutoRecordEnabled('https://example.com/watch', rules)).toBe(true);
    expect(isSiteAutoRecordEnabled('https://other.example.com/watch', rules)).toBe(true);
    expect(isSiteAutoRecordEnabled('https://player.example.com/watch', rules)).toBe(false);
    expect(isSiteAutoRecordEnabled('https://child.player.example.com/watch', rules)).toBe(false);
  });
  it('normalizes input and rejects URLs and wildcard domains', () => {
    expect(normalizeDomain(' Example.COM. ')).toBe('example.com');
    for (const value of ['https://example.com', '*.example.com', 'example.com/path', '-bad.com']) {
      expect(() => normalizeDomain(value)).toThrow();
    }
  });
  it('enforces label and total domain length limits', () => {
    const maxDomain = [63, 63, 63, 61].map(length => 'a'.repeat(length)).join('.');
    expect(normalizeDomain(maxDomain)).toBe(maxDomain);
    expect(normalizeDomain(`${'a'.repeat(63)}.com`)).toBe(`${'a'.repeat(63)}.com`);
    expect(() => normalizeDomain(`${'a'.repeat(64)}.com`)).toThrow();
    expect(() => normalizeDomain(`${maxDomain}a`)).toThrow();
  });
  it.each([
    [' Example.COM. ', 'example.com'],
    ['https://www.Example.com/watch?v=1#player', 'www.example.com'],
    [' HTTP://player.Example.com:8080/watch ', 'player.example.com'],
    ['https://example.com./', 'example.com'],
    ['https://example.com/watch?next=https://other.com', 'example.com'],
  ])('extracts the domain from %s without changing its scope', (input, domain) => {
    expect(parseSiteDomain(input)).toBe(domain);
  });
  it.each([
    '', 'https://', 'https:///example.com', 'ftp://example.com', '*.example.com',
    'https://*.example.com', 'example.com/path', 'https://user:pass@example.com',
    'https://example.com/a b', 'https://exa\nmple.com', 'https://example.com\\path',
    `https://${'a'.repeat(64)}.com/watch`,
  ])('rejects invalid site input %j', (input) => {
    expect(() => parseSiteDomain(input)).toThrow();
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
