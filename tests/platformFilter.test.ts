import { describe, expect, it } from 'vitest';
import { customPlatformOptions, matchesPlatform } from '../src/shared/platformFilter';

describe('custom platform filters', () => {
  it('lists new sites without records and preserves historical sites', () => {
    expect(customPlatformOptions([{ domain: 'example.com', enabled: false, addedAt: 1 }], [
      { platform: 'generic', url: 'https://player.example.com/watch' },
      { platform: 'manual', url: 'https://old.test/watch' },
      { platform: 'youtube', url: 'https://www.youtube.com/watch' },
      { platform: 'generic', url: 'invalid' },
    ])).toEqual([
      { label: 'example.com', value: 'site:example.com' },
      { label: 'old.test', value: 'site:old.test' },
    ]);
  });
  it('matches old generic and manual records by domain with subdomain boundaries', () => {
    expect(matchesPlatform({ platform: 'generic', url: 'https://player.example.com/watch' }, 'site:example.com')).toBe(true);
    expect(matchesPlatform({ platform: 'manual', url: 'https://example.com/watch' }, 'site:example.com')).toBe(true);
    expect(matchesPlatform({ platform: 'generic', url: 'https://fakeexample.com/watch' }, 'site:example.com')).toBe(false);
    expect(matchesPlatform({ platform: 'generic', url: 'invalid' }, 'site:example.com')).toBe(false);
    expect(matchesPlatform({ platform: 'youtube', url: 'invalid' }, 'youtube')).toBe(true);
    expect(matchesPlatform({ platform: 'generic', url: 'invalid' }, 'all')).toBe(true);
  });
});
